import { describe, it, expect, vi, beforeEach } from 'vitest'

const eqMock = vi.fn()

vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({ eq: eqMock }),
    }),
  },
}))

const { getTodayCatch } = await import('../../src/tools/get-today-catch')
const { supabase } = await import('../../src/lib/supabase')

describe('getTodayCatch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    eqMock.mockReset()
  })

  it('returns formatted catch list with status and descriptions', async () => {
    eqMock.mockResolvedValue({
      data: [
        {
          status: 'available',
          notes: 'large ones today',
          catch_items: {
            name: 'Mud Crab',
            origin_region: 'Kerala',
            description: 'Live Kerala mud crab',
            recommended_preps: ['Ghee Roast', 'Pepper Masala'],
            allergens: ['Shellfish'],
          },
        },
        {
          status: 'sold_out',
          notes: null,
          catch_items: {
            name: 'Lobster',
            origin_region: 'Kerala',
            description: 'Whole lobster',
            recommended_preps: ['Butter Pepper Garlic'],
            allergens: ['Shellfish'],
          },
        },
      ],
      error: null,
    } as unknown)

    const result = await getTodayCatch()

    expect(result).toContain('Mud Crab')
    expect(result).toContain('available')
    expect(result).toContain('large ones today')
    expect(result).toContain('Lobster')
    expect(result).toContain('sold_out')
  })

  it('returns "No catch data" message when table is empty', async () => {
    eqMock.mockResolvedValue({
      data: [],
      error: null,
    } as unknown)

    const result = await getTodayCatch()
    expect(result).toContain('No catch availability')
  })

  it('handles catch_items being null gracefully', async () => {
    eqMock.mockResolvedValue({
      data: [
        {
          status: 'available',
          notes: null,
          catch_items: null,
        },
        {
          status: 'available',
          notes: null,
          catch_items: {
            name: 'Mud Crab',
            origin_region: 'Kerala',
            description: 'Live Kerala mud crab',
            recommended_preps: ['Ghee Roast'],
            allergens: ['Shellfish'],
          },
        },
      ],
      error: null,
    } as unknown)

    const result = await getTodayCatch()

    expect(result).toContain('Mud Crab')
  })

  it('uses "ask staff" fallback when recommended_preps is null or empty', async () => {
    eqMock.mockResolvedValue({
      data: [
        {
          status: 'available',
          notes: null,
          catch_items: {
            name: 'Fish',
            origin_region: 'Kerala',
            description: 'Fresh fish',
            recommended_preps: null,
            allergens: ['Fish'],
          },
        },
        {
          status: 'available',
          notes: null,
          catch_items: {
            name: 'Prawn',
            origin_region: 'Kerala',
            description: 'Fresh prawn',
            recommended_preps: [],
            allergens: ['Shellfish'],
          },
        },
      ],
      error: null,
    } as unknown)

    const result = await getTodayCatch()

    expect(result).toContain('Fish')
    expect(result).toContain('ask staff')
    expect(result).toContain('Prawn')
  })
})
