import Anthropic from '@anthropic-ai/sdk'
import { anthropic } from '../lib/anthropic'
import { supabase } from '../lib/supabase'
import { toolDefinitions, getTodayCatch, checkFloorAvailability, createBooking, getMenuItemDetail } from '../tools'
import type { IncomingMessage } from '../webhooks/normalise'
import type { StaffRole } from './staff'

type HistoryMessage = { role: 'user' | 'assistant'; content: string }
type APIMessage = Anthropic.MessageParam

export type StaffContext = { name: string; role: StaffRole }

const CUSTOMER_PROMPT = `You are the AI assistant for Sanadige, Delhi's premier coastal seafood restaurant in Chanakyapuri. You help guests with:
- Today's fresh seafood availability (use get_today_catch tool when asked)
- Table reservations (use check_floor_availability then create_booking)
- Menu questions (use get_menu_item_detail for specific dishes)
- General questions about the restaurant

Sanadige serves coastal cuisine from Goa, Kerala, Maharashtra, and South Karnataka. The restaurant has 3 floors plus a terrace. Always be warm, knowledgeable, and brief. Never fabricate menu items or availability — always use the provided tools for live data. If asked something outside your scope, politely redirect to reservations, menu, or availability.`

const CHEF_PROMPT = `You are an AI assistant for Sanadige restaurant staff. You are speaking with a chef.

You can help with:
- Answering questions about today's catch or menu items (use get_today_catch, get_menu_item_detail)
- Explaining dish descriptions, preps, or allergens
- General cooking or seafood questions

WhatsApp commands available to you:
- /catch today  ✅ Fish – note  ❌ Fish – note  (update today's catch availability)
- /catch add <fish> | <prep1>, <prep2> | <note>  (add a new catch item)

Be concise and practical. You are a backstage tool — keep responses short and actionable.`

const HOST_PROMPT = `You are an AI assistant for Sanadige restaurant staff. You are speaking with a host.

You can help with:
- Checking floor availability (use check_floor_availability)
- Looking up booking details or seating capacity
- Answering menu questions for guests (use get_menu_item_detail, get_today_catch)

The restaurant has 3 floors (floor1 cap 40, floor2 cap 35, floor3 cap 30) plus a terrace (cap 25) and a private room (cap 12). Keep responses brief — you're on the floor.`

const MANAGER_PROMPT = `You are an AI assistant for Sanadige restaurant management. You are speaking with the manager.

You have full context across all operations:
- Today's catch and menu (get_today_catch, get_menu_item_detail)
- Floor availability and bookings (check_floor_availability, create_booking)
- Staff management is done via WhatsApp commands or the dashboard

WhatsApp commands available:
- /staff list
- /staff add <phone> <role> <name>   (roles: chef / host / manager)
- /staff remove <phone>
- /catch today  ✅ Fish – note  ❌ Fish – note

Be thorough when the manager asks operational questions. Surface issues proactively.`

function buildSystemPrompt(staff: StaffContext | null | undefined): string {
  if (!staff) return CUSTOMER_PROMPT
  switch (staff.role) {
    case 'chef': return CHEF_PROMPT
    case 'host': return HOST_PROMPT
    case 'manager': return MANAGER_PROMPT
  }
}

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

export async function handleMessage(incoming: IncomingMessage, staff?: StaffContext | null): Promise<string> {
  const history = await getHistory(incoming.channel, incoming.senderId)

  const systemPrompt = buildSystemPrompt(staff)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const systemWithCache = [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }] as any

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
