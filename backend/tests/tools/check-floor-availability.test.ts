import { describe, it, expect, vi, beforeEach } from 'vitest'

const eqStatusMock = vi.fn()
vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        gte: vi.fn().mockReturnValue({
          lt: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({ eq: eqStatusMock }),
          }),
        }),
      }),
    }),
  },
}))

const { checkFloorAvailability } = await import('../../src/tools/check-floor-availability')

describe('checkFloorAvailability', () => {
  beforeEach(() => eqStatusMock.mockReset())

  it('returns available when bookings are below capacity', async () => {
    eqStatusMock.mockResolvedValue({ data: [{ id: '1' }, { id: '2' }], error: null })

    const result = await checkFloorAvailability('terrace', '2026-04-19T20:00:00Z', 4)
    expect(result).toContain('available')
    expect(result).toContain('terrace')
  })

  it('returns unavailable when floor is at capacity', async () => {
    eqStatusMock.mockResolvedValue({ data: Array(6).fill({ id: '1' }), error: null })

    const result = await checkFloorAvailability('terrace', '2026-04-19T20:00:00Z', 4)
    expect(result).toContain('fully booked')
  })
})
