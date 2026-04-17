import Anthropic from '@anthropic-ai/sdk'
import { anthropic } from '../lib/anthropic'
import { supabase } from '../lib/supabase'
import { toolDefinitions, getTodayCatch, checkFloorAvailability, createBooking, getMenuItemDetail } from '../tools'
import type { IncomingMessage } from '../webhooks/normalise'

type HistoryMessage = { role: 'user' | 'assistant'; content: string }
type APIMessage = Anthropic.MessageParam

const SYSTEM_PROMPT = `You are the AI assistant for Sanadige, Delhi's premier coastal seafood restaurant in Chanakyapuri. You help guests with:
- Today's fresh seafood availability (use get_today_catch tool when asked)
- Table reservations (use check_floor_availability then create_booking)
- Menu questions (use get_menu_item_detail for specific dishes)
- General questions about the restaurant

Sanadige serves coastal cuisine from Goa, Kerala, Maharashtra, and South Karnataka. The restaurant has 3 floors plus a terrace. Always be warm, knowledgeable, and brief. Never fabricate menu items or availability — always use the provided tools for live data. If asked something outside your scope, politely redirect to reservations, menu, or availability.`

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const systemWithCache = [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }] as any

async function getHistory(channel: string, senderId: string): Promise<HistoryMessage[]> {
  const { data, error } = await supabase
    .from('conversations')
    .select('messages')
    .eq('channel', channel)
    .eq('sender_id', senderId)
    .single()
  if (error && error.code !== 'PGRST116') {
    console.error('[getHistory] Supabase error:', error)
  }
  return (data?.messages as HistoryMessage[]) ?? []
}

async function saveHistory(channel: string, senderId: string, messages: HistoryMessage[]): Promise<void> {
  const trimmed = messages.slice(-20)
  const { error } = await supabase.from('conversations').upsert(
    { channel, sender_id: senderId, messages: trimmed, last_active: new Date().toISOString() },
    { onConflict: 'channel,sender_id' }
  )
  if (error) console.error('[saveHistory] Supabase upsert failed:', error)
}

async function executeTool(name: string, input: Record<string, unknown>): Promise<string> {
  switch (name) {
    case 'get_today_catch':
      return getTodayCatch()
    case 'check_floor_availability':
      return checkFloorAvailability(input.floor as string, input.datetime as string, input.party_size as number)
    case 'create_booking':
      return createBooking({
        guestName: input.guest_name as string,
        phone: input.phone as string,
        whatsappId: input.whatsapp_id as string,
        partySize: input.party_size as number,
        datetime: input.datetime as string,
        floor: input.floor as 'terrace' | 'floor1' | 'floor2' | 'private',
        specialNotes: (input.special_notes as string) ?? null,
      })
    case 'get_menu_item_detail':
      return getMenuItemDetail(input.item_name as string)
    default:
      return `Unknown tool: ${name}`
  }
}

export async function handleMessage(incoming: IncomingMessage): Promise<string> {
  const history = await getHistory(incoming.channel, incoming.senderId)

  // apiMessages holds the full conversation for the Anthropic API (content can be blocks)
  // historyMessages tracks string-only content for Supabase persistence
  const apiMessages: APIMessage[] = [
    ...history.map(m => ({ role: m.role, content: m.content })),
    { role: 'user' as const, content: incoming.text },
  ]
  const historyMessages: HistoryMessage[] = [
    ...history,
    { role: 'user', content: incoming.text },
  ]

  let response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: systemWithCache,
    tools: toolDefinitions,
    messages: apiMessages,
  })

  while (response.stop_reason === 'tool_use') {
    const toolUseBlocks = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
    )
    const toolResults = await Promise.all(
      toolUseBlocks.map(async (block) => {
        const result = await executeTool(block.name, block.input as Record<string, unknown>)
        return { type: 'tool_result' as const, tool_use_id: block.id, content: result }
      })
    )

    // API accumulator: assistant turn with full content blocks, then tool results as user turn
    apiMessages.push({ role: 'assistant', content: response.content })
    apiMessages.push({ role: 'user', content: toolResults })

    response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: systemWithCache,
      tools: toolDefinitions,
      messages: apiMessages,
    })
  }

  const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text')
  const replyText = textBlock ? textBlock.text : 'Sorry, I could not process that. Please try again.'

  await saveHistory(incoming.channel, incoming.senderId, [
    ...historyMessages,
    { role: 'assistant', content: replyText },
  ])

  return replyText
}
