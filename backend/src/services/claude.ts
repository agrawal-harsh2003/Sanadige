import Groq from 'groq-sdk'
import { groq } from '../lib/anthropic'
import { supabase } from '../lib/supabase'
import { toolDefinitions, getTodayCatch, checkFloorAvailability, createBooking, getMenuItemDetail } from '../tools'
import type { IncomingMessage } from '../webhooks/normalise'
import type { StaffRole } from './staff'

type HistoryMessage = { role: 'user' | 'assistant'; content: string }
type ChatMessage = Groq.Chat.ChatCompletionMessageParam

export type StaffContext = { name: string; role: StaffRole }

const GROQ_MODEL = 'llama-3.3-70b-versatile'

// Convert Anthropic-format tool definitions to OpenAI/Groq format
const groqTools: Groq.Chat.ChatCompletionTool[] = toolDefinitions.map(t => ({
  type: 'function',
  function: {
    name: t.name,
    description: t.description,
    parameters: t.input_schema,
  },
}))

const CUSTOMER_PROMPT = `You are the AI assistant for Sanadige, Delhi's premier coastal seafood restaurant in Chanakyapuri. You help guests with:
- Today's fresh seafood availability (use get_today_catch tool when asked)
- Table reservations (use check_floor_availability then create_booking)
- Menu questions (use get_menu_item_detail for specific dishes)
- General questions about the restaurant

Sanadige serves coastal cuisine from Goa, Kerala, Maharashtra, and South Karnataka. The restaurant has 3 floors plus a terrace. Always be warm, knowledgeable, and brief. Never fabricate menu items or availability — always use the provided tools for live data. If asked something outside your scope, politely redirect to reservations, menu, or availability.`

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

export async function handleMessage(incoming: IncomingMessage, _staff?: StaffContext | null): Promise<string> {
  const history = await getHistory(incoming.channel, incoming.senderId)

  const messages: ChatMessage[] = [
    { role: 'system', content: CUSTOMER_PROMPT },
    ...history.map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: incoming.text },
  ]

  const historyMessages: HistoryMessage[] = [
    ...history,
    { role: 'user', content: incoming.text },
  ]

  let response = await groq.chat.completions.create({
    model: GROQ_MODEL,
    max_tokens: 1024,
    tools: groqTools,
    messages,
  })

  while (response.choices[0].finish_reason === 'tool_calls') {
    const assistantMessage = response.choices[0].message
    const toolCalls = assistantMessage.tool_calls ?? []

    messages.push(assistantMessage)

    const toolResults = await Promise.all(
      toolCalls.map(async (call) => {
        const input = JSON.parse(call.function.arguments || '{}') as Record<string, unknown>
        const result = await executeTool(call.function.name, input)
        return {
          role: 'tool' as const,
          tool_call_id: call.id,
          content: result,
        }
      })
    )

    messages.push(...toolResults)

    response = await groq.chat.completions.create({
      model: GROQ_MODEL,
      max_tokens: 1024,
      tools: groqTools,
      messages,
    })
  }

  const replyText = response.choices[0].message.content ?? 'Sorry, I could not process that. Please try again.'

  await saveHistory(incoming.channel, incoming.senderId, [
    ...historyMessages,
    { role: 'assistant', content: replyText },
  ])

  return replyText
}
