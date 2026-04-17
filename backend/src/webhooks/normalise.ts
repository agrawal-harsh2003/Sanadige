export interface IncomingMessage {
  channel: 'whatsapp' | 'instagram' | 'web'
  senderId: string
  text: string
}

export function normaliseWhatsApp(body: unknown): IncomingMessage | null {
  const b = body as Record<string, unknown>
  const value = (b?.entry as Array<{ changes: Array<{ value: Record<string, unknown> }> }>)
    ?.[0]?.changes?.[0]?.value

  if (!value || !Array.isArray(value.messages)) return null
  const messages = value.messages as Array<Record<string, unknown>>

  if (messages.length === 0) return null
  const msg = messages[0]
  if (msg.type !== 'text') return null

  if (!msg.from || typeof msg.from !== 'string') return null
  const text = (msg.text as { body: string }).body
  if (!text || !text.trim()) return null

  return {
    channel: 'whatsapp',
    senderId: msg.from,
    text,
  }
}

export function normaliseInstagram(body: unknown): IncomingMessage | null {
  const b = body as Record<string, unknown>
  const messaging = (b?.entry as Array<{ messaging: Array<Record<string, unknown>> }>)
    ?.[0]?.messaging?.[0]

  if (!messaging) return null
  const text = (messaging.message as { text?: string })?.text
  if (!text || !text.trim()) return null

  return {
    channel: 'instagram',
    senderId: (messaging.sender as { id: string }).id,
    text,
  }
}
