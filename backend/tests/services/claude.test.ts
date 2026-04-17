import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { IncomingMessage } from '../../src/webhooks/normalise'

const singleMock = vi.fn()
vi.mock('../../src/lib/anthropic', () => ({
  anthropic: { messages: { create: vi.fn() } },
}))
vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ single: singleMock }),
        }),
      }),
      upsert: vi.fn().mockResolvedValue({ error: null }),
    }),
  },
}))
vi.mock('../../src/tools', () => ({
  toolDefinitions: [],
  getTodayCatch: vi.fn().mockResolvedValue('Anjal: available. Lobster: sold_out.'),
  checkFloorAvailability: vi.fn(),
  createBooking: vi.fn(),
  getMenuItemDetail: vi.fn(),
}))

const { handleMessage } = await import('../../src/services/claude')
const { anthropic } = await import('../../src/lib/anthropic')

describe('handleMessage', () => {
  beforeEach(() => {
    singleMock.mockReset()
    vi.mocked(anthropic.messages.create).mockReset()
  })

  it('returns Claude text response for a simple availability question', async () => {
    singleMock.mockResolvedValue({ data: { messages: [] }, error: null })
    vi.mocked(anthropic.messages.create).mockResolvedValue({
      content: [{ type: 'text', text: 'Yes! Anjal is in today from Goa.' }],
      stop_reason: 'end_turn',
    } as unknown)

    const msg: IncomingMessage = { channel: 'whatsapp', senderId: '919876543210', text: 'Is Anjal in today?' }
    const reply = await handleMessage(msg)

    expect(reply).toBe('Yes! Anjal is in today from Goa.')
  })

  it('executes tool when Claude returns tool_use stop reason', async () => {
    singleMock.mockResolvedValue({ data: { messages: [] }, error: null })
    vi.mocked(anthropic.messages.create)
      .mockResolvedValueOnce({
        content: [{ type: 'tool_use', id: 'tool_1', name: 'get_today_catch', input: {} }],
        stop_reason: 'tool_use',
      } as unknown)
      .mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Today we have Anjal and Mud Crab.' }],
        stop_reason: 'end_turn',
      } as unknown)

    const msg: IncomingMessage = { channel: 'whatsapp', senderId: '919876543210', text: "What's in today?" }
    const reply = await handleMessage(msg)

    expect(anthropic.messages.create).toHaveBeenCalledTimes(2)
    expect(reply).toBe('Today we have Anjal and Mud Crab.')
  })
})
