import { describe, it, expect, vi, beforeEach } from 'vitest'

const { singleMock, upsertMock, deleteMock, orderMock } = vi.hoisted(() => ({
  singleMock: vi.fn(),
  upsertMock: vi.fn(),
  deleteMock: vi.fn(),
  orderMock: vi.fn(),
}))

vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ single: singleMock }),
        order: orderMock,
      }),
      upsert: upsertMock,
      delete: vi.fn().mockReturnValue({ eq: deleteMock }),
    }),
  },
}))

vi.mock('../../src/env', () => ({
  env: { MANAGER_PHONE: '919999999999' },
}))

const { getStaff, handleStaffCommand } = await import('../../src/services/staff')

describe('getStaff', () => {
  beforeEach(() => singleMock.mockReset())

  it('returns staff member when phone matches', async () => {
    singleMock.mockResolvedValue({
      data: { phone: '919876543210', name: 'Rajesh', role: 'chef' },
      error: null,
    })
    const result = await getStaff('919876543210')
    expect(result).toEqual({ phone: '919876543210', name: 'Rajesh', role: 'chef' })
  })

  it('returns null when phone is not in staff table', async () => {
    singleMock.mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
    const result = await getStaff('919000000000')
    expect(result).toBeNull()
  })
})

describe('handleStaffCommand', () => {
  beforeEach(() => {
    upsertMock.mockReset()
    deleteMock.mockReset()
    orderMock.mockReset()
  })

  it('lists staff members', async () => {
    orderMock.mockResolvedValue({
      data: [{ phone: '919876543210', name: 'Rajesh', role: 'chef' }],
      error: null,
    })
    const result = await handleStaffCommand('/staff list', '919999999999')
    expect(result).toContain('Rajesh')
    expect(result).toContain('chef')
  })

  it('adds a new staff member', async () => {
    upsertMock.mockResolvedValue({ error: null })
    const result = await handleStaffCommand('/staff add 919876543210 chef Rajesh', '919999999999')
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ phone: '919876543210', name: 'Rajesh', role: 'chef' }),
      expect.anything()
    )
    expect(result).toContain('Rajesh')
  })

  it('rejects unknown role', async () => {
    const result = await handleStaffCommand('/staff add 919876543210 waiter Rajesh', '919999999999')
    expect(result).toContain('Role must be one of')
  })

  it('prevents removing the env-seeded manager', async () => {
    const result = await handleStaffCommand('/staff remove 919999999999', '919999999999')
    expect(result).toContain('Cannot remove the primary manager')
  })

  it('removes a staff member', async () => {
    deleteMock.mockResolvedValue({ error: null })
    const result = await handleStaffCommand('/staff remove 919876543210', '919999999999')
    expect(deleteMock).toHaveBeenCalledWith('phone', '919876543210')
    expect(result).toContain('removed')
  })

  it('returns usage hint for missing add arguments', async () => {
    const result = await handleStaffCommand('/staff add', '919999999999')
    expect(result).toContain('Usage:')
  })
})
