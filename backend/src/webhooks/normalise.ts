export interface IncomingMessage {
  channel: 'whatsapp' | 'instagram' | 'web'
  senderId: string
  text: string
  interactiveId?: string
}

export function normaliseWhatsApp(body: unknown): IncomingMessage | null {
  const b = body as Record<string, unknown>
  const value = (b?.entry as Array<{ changes: Array<{ value: Record<string, unknown> }> }>)
    ?.[0]?.changes?.[0]?.value

  if (!value || !Array.isArray(value.messages)) return null
  const messages = value.messages as Array<Record<string, unknown>>
  if (messages.length === 0) return null

  const msg = messages[0]
  if (!msg.from || typeof msg.from !== 'string') return null
  const from = msg.from

  if (msg.type === 'text') {
    const text = (msg.text as { body: string })?.body
    if (!text?.trim()) return null
    return { channel: 'whatsapp', senderId: from, text }
  }

  if (msg.type === 'interactive') {
    const interactive = msg.interactive as Record<string, unknown>
    const type = interactive?.type as string

    if (type === 'button_reply') {
      const reply = interactive.button_reply as { id: string; title: string }
      return { channel: 'whatsapp', senderId: from, text: reply.title, interactiveId: reply.id }
    }

    if (type === 'list_reply') {
      const reply = interactive.list_reply as { id: string; title: string }
      return { channel: 'whatsapp', senderId: from, text: reply.title, interactiveId: reply.id }
    }
  }

  return null
}

export function normaliseInstagram(body: unknown): IncomingMessage | null {
  const b = body as Record<string, unknown>
  const messaging = (b?.entry as Array<{ messaging: Array<Record<string, unknown>> }>)
    ?.[0]?.messaging?.[0]

  if (!messaging) return null
  const text = (messaging.message as { text?: string })?.text
  if (!text?.trim()) return null

  return {
    channel: 'instagram',
    senderId: (messaging.sender as { id: string }).id,
    text,
  }
}
