import { describe, it, expect, vi, beforeEach } from 'vitest'

const singleMock = vi.fn()
vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        ilike: vi.fn().mockReturnValue({ single: singleMock }),
      }),
      upsert: vi.fn().mockResolvedValue({ error: null }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    }),
  },
}))

const { parseCatchCommand } = await import('../../src/services/catch')
const { supabase } = await import('../../src/lib/supabase')

describe('parseCatchCommand', () => {
  beforeEach(() => {
    singleMock.mockReset()
    vi.mocked(supabase.from).mockClear()
  })

  it('parses ✅ lines as available and ❌ lines as sold_out', async () => {
    singleMock
      .mockResolvedValueOnce({ data: { id: 'uuid-anjal' }, error: null })
      .mockResolvedValueOnce({ data: { id: 'uuid-lobster' }, error: null })

    const command = `/catch today\n✅ Anjal – Goan\n❌ Lobster – not today`
    const result = await parseCatchCommand(command, 'chef_phone')

    expect(result).toContain('Catch updated')
    expect(result).toContain('2 items')
  })

  it('returns error message for unknown fish name', async () => {
    singleMock.mockResolvedValue({ data: null, error: { message: 'not found' } })

    const command = `/catch today\n✅ UnknownFish`
    const result = await parseCatchCommand(command, 'chef_phone')

    expect(result).toContain('not found in the catalogue')
  })
})
