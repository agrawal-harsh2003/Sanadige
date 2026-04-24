import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { IncomingMessage } from '../../src/webhooks/normalise'

const createMock = vi.fn()
vi.mock('../../src/lib/anthropic', () => ({
  groq: { chat: { completions: { create: createMock } } },
}))
vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { messages: [] }, error: null }) }),
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

describe('handleMessage', () => {
  beforeEach(() => {
    createMock.mockReset()
  })

  it('returns text response for a simple availability question', async () => {
    createMock.mockResolvedValue({
      choices: [{ finish_reason: 'stop', message: { content: 'Yes! Anjal is in today from Goa.', tool_calls: null } }],
    })

    const msg: IncomingMessage = { channel: 'whatsapp', senderId: '919876543210', text: 'Is Anjal in today?' }
    const reply = await handleMessage(msg)

    expect(reply).toBe('Yes! Anjal is in today from Goa.')
  })

  it('executes tool when model returns tool_calls finish reason', async () => {
    createMock
      .mockResolvedValueOnce({
        choices: [{
          finish_reason: 'tool_calls',
          message: {
            content: null,
            tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'get_today_catch', arguments: '{}' } }],
          },
        }],
      })
      .mockResolvedValueOnce({
        choices: [{ finish_reason: 'stop', message: { content: 'Today we have Anjal and Mud Crab.', tool_calls: null } }],
      })

    const msg: IncomingMessage = { channel: 'whatsapp', senderId: '919876543210', text: "What's in today?" }
    const reply = await handleMessage(msg)

    expect(createMock).toHaveBeenCalledTimes(2)
    expect(reply).toBe('Today we have Anjal and Mud Crab.')
  })
})
