import { describe, it, expect, vi, beforeEach } from 'vitest'

const singleMock = vi.fn()
vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({ single: singleMock }),
      }),
    }),
  },
}))

const { createBooking } = await import('../../src/tools/create-booking')

describe('createBooking', () => {
  beforeEach(() => singleMock.mockReset())

  it('creates booking and returns confirmation with ref', async () => {
    singleMock.mockResolvedValue({
      data: {
        booking_ref: 'SND-0001',
        guest_name: 'Priya Sharma',
        datetime: '2026-04-19T14:30:00.000Z',
        floor: 'terrace',
        party_size: 6,
      },
      error: null,
    })

    const result = await createBooking({
      guestName: 'Priya Sharma',
      phone: '919876543210',
      whatsappId: '919876543210',
      partySize: 6,
      datetime: '2026-04-19T20:00:00+05:30',
      floor: 'terrace',
      specialNotes: 'Birthday dinner',
    })

    expect(result).toContain('SND-0001')
    expect(result).toContain('Priya Sharma')
    expect(result).toContain('terrace')
  })

  it('throws on Supabase error', async () => {
    singleMock.mockResolvedValue({ data: null, error: { message: 'duplicate key' } })

    await expect(createBooking({
      guestName: 'Test',
      phone: '919876543210',
      whatsappId: '919876543210',
      partySize: 2,
      datetime: '2026-04-19T20:00:00Z',
      floor: 'floor1',
      specialNotes: null,
    })).rejects.toThrow('duplicate key')
  })
})
