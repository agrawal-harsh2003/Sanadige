import Groq from 'groq-sdk'
import { groq } from '../lib/anthropic'
import { db } from '../lib/firebase'
import { toolDefinitions, checkFloorAvailability, createBooking } from '../tools'
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

function istNow(): string {
  return new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 16) + ' IST'
}

function istDateStrings(): { today: string; tomorrow: string } {
  const now = new Date(Date.now() + 5.5 * 60 * 60 * 1000)
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  return {
    today: now.toISOString().split('T')[0],
    tomorrow: tomorrow.toISOString().split('T')[0],
  }
}

function parseBookingSuccess(result: string): string | null {
  if (!result.startsWith('BOOKING_SUCCESS|')) return null
  const parts = Object.fromEntries(
    result.slice('BOOKING_SUCCESS|'.length).split('|').map(p => p.split(':') as [string, string])
  )
  const floorLabel: Record<string, string> = { terrace: 'Terrace', floor1: 'Floor 1', floor2: 'Floor 2', private: 'Private Room' }
  return `✅ Booking confirmed!\n\n` +
    `📋 Ref: *${parts.ref}*\n` +
    `👤 ${parts.name}\n` +
    `👥 ${parts.guests} guest${Number(parts.guests) !== 1 ? 's' : ''}\n` +
    `📍 ${floorLabel[parts.floor] ?? parts.floor}\n` +
    `📅 ${parts.date} at ${parts.time}\n\n` +
    `We look forward to welcoming you! See you soon 🌊`
}

function buildSystemPrompt(senderPhone: string): string {
  const { today, tomorrow } = istDateStrings()
  return `You are the AI assistant for Sanadige, Delhi's premier coastal seafood restaurant in Chanakyapuri.

TODAY (IST): ${istNow()}
TODAY DATE: ${today}
TOMORROW DATE: ${tomorrow}
GUEST PHONE (WhatsApp): ${senderPhone}

You help guests with table reservations, today's seafood availability, menu questions, and general restaurant info.

━━━ BOOKING FLOW — FOLLOW THIS EXACTLY, ONE MESSAGE PER STEP ━━━

When a guest wants to make a reservation, ask ONE question at a time in this order and WAIT for their reply before moving on:

Step 1 — NAME: Ask "What's your name?" (phone is already known)
Step 2 — PARTY SIZE: Ask "How many guests will be dining?"
Step 3 — DATE: Ask "What date would you like to book? (e.g. 25 April, tomorrow, this Saturday)" — ALWAYS ask this, never assume
Step 4 — TIME: Ask "What time suits you? We have lunch (12:00–2:30 PM) and dinner (7:00–10:00 PM)" — ALWAYS ask this, never assume
Step 5 — AREA: Ask "Which seating area do you prefer? Terrace / Floor 1 / Floor 2 / Private Room"
Step 6 — CONFIRM: Show full summary and ask "Shall I confirm this booking? (yes/no)"
Step 7 — BOOK: Only after guest says YES — call check_floor_availability with the real values, then call create_booking

CRITICAL RULES:
- Complete every step — NEVER skip Step 3 (date) or Step 4 (time)
- NEVER call any tool until you have the guest's real answers for ALL steps
- NEVER invent or assume a date or time — always ask and wait for the answer
- Tool arguments must use REAL values. Use the dates above to build ISO 8601 datetimes:
  - "today" → ${today}, "tomorrow" → ${tomorrow}
  - Always append the IST offset: e.g. ${today}T20:00:00+05:30
- Use ${senderPhone} for both "phone" and "whatsapp_id" in create_booking
- party_size must be a string of the number, e.g. "4"
- Keep messages short and friendly — this is WhatsApp
- When create_booking succeeds, the system will send a confirmation message automatically. Just reply "Your booking is confirmed! 🎉"

━━━ OTHER ━━━
- For anything outside reservations, politely redirect to calling the restaurant
- Phone: +91 91678 85275

Sanadige serves coastal cuisine from Goa, Kerala, Karnataka, and Maharashtra. 3 floors + rooftop terrace.`
}

async function getHistory(channel: string, senderId: string): Promise<HistoryMessage[]> {
  const docId = `${channel}_${senderId}`
  const doc = await db.collection('conversations').doc(docId).get()
  if (!doc.exists) return []
  return (doc.data()?.messages ?? []) as HistoryMessage[]
}

async function saveHistory(channel: string, senderId: string, messages: HistoryMessage[]): Promise<void> {
  const docId = `${channel}_${senderId}`
  const trimmed = messages.slice(-20)
  await db.collection('conversations').doc(docId).set({
    messages: trimmed,
    updatedAt: new Date().toISOString(),
  })
}

async function executeTool(name: string, input: Record<string, unknown>): Promise<string> {
  switch (name) {
    case 'check_floor_availability':
      return checkFloorAvailability(input.floor as string, input.datetime as string)
    case 'create_booking':
      return createBooking(input as Parameters<typeof createBooking>[0])
    default:
      return `Unknown tool: ${name}`
  }
}

export async function handleMessage(incoming: IncomingMessage, _staff?: StaffContext | null): Promise<string> {
  const history = await getHistory(incoming.channel, incoming.senderId)

  const messages: ChatMessage[] = [
    { role: 'system', content: buildSystemPrompt(incoming.senderId) },
    ...history.map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: incoming.text },
  ]

  const historyMessages: HistoryMessage[] = [
    ...history,
    { role: 'user', content: incoming.text },
  ]

  let response = await groq.chat.completions.create({
    model: GROQ_MODEL,
    max_tokens: 512,
    tools: groqTools,
    messages,
  })

  while (response.choices[0].finish_reason === 'tool_calls') {
    const assistantMessage = response.choices[0].message
    const toolCalls = assistantMessage.tool_calls ?? []

    messages.push(assistantMessage)

    let bookingConfirmation: string | null = null

    const toolResults = await Promise.all(
      toolCalls.map(async (call) => {
        const input = JSON.parse(call.function.arguments || '{}') as Record<string, unknown>
        console.log(`[claude] tool call: ${call.function.name}`, input)
        const result = await executeTool(call.function.name, input)
        if (call.function.name === 'create_booking') {
          const confirmation = parseBookingSuccess(result)
          if (confirmation) bookingConfirmation = confirmation
        }
        return {
          role: 'tool' as const,
          tool_call_id: call.id,
          content: result,
        }
      })
    )

    // If booking was just created, short-circuit with the formatted confirmation
    if (bookingConfirmation) {
      await saveHistory(incoming.channel, incoming.senderId, [
        ...historyMessages,
        { role: 'assistant', content: bookingConfirmation },
      ])
      return bookingConfirmation
    }

    messages.push(...toolResults)

    response = await groq.chat.completions.create({
      model: GROQ_MODEL,
      max_tokens: 512,
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
