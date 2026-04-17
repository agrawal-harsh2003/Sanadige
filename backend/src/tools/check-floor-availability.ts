import { supabase } from '../lib/supabase'

const FLOOR_CAPACITY: Record<string, number> = {
  terrace: 6,
  floor1: 6,
  floor2: 8,
  private: 1,
}

export async function checkFloorAvailability(
  floor: string,
  datetime: string,
  partySize: number
): Promise<string> {
  const requested = new Date(datetime)
  const windowStart = new Date(requested.getTime() - 2 * 60 * 60 * 1000).toISOString()
  const windowEnd = new Date(requested.getTime() + 2 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('bookings')
    .select('id')
    .gte('datetime', windowStart)
    .lt('datetime', windowEnd)
    .eq('floor', floor)
    .eq('status', 'confirmed')

  if (error) throw new Error(`Failed to check availability: ${error.message}`)

  const capacity = FLOOR_CAPACITY[floor]
  if (capacity === undefined) throw new Error(`Unknown floor: ${floor}`)
  const booked = data?.length ?? 0
  const remaining = capacity - booked

  if (remaining <= 0) {
    const alternatives = Object.keys(FLOOR_CAPACITY).filter(f => f !== floor).join(', ')
    return `The ${floor} is fully booked for ${datetime}. Suggest alternative: ${alternatives}.`
  }

  return `The ${floor} is available for ${datetime}. ${remaining} table(s) remaining. Party size ${partySize} can be accommodated.`
}

export const checkFloorAvailabilityDefinition = {
  name: 'check_floor_availability',
  description: 'Check if a specific floor (terrace, floor1, floor2, private) has availability for a given date, time, and party size. Call this when a customer wants to book a table or asks about seating availability.',
  input_schema: {
    type: 'object' as const,
    properties: {
      floor: { type: 'string', enum: ['terrace', 'floor1', 'floor2', 'private'], description: 'Which floor the guest wants' },
      datetime: { type: 'string', description: 'ISO 8601 datetime the guest wants to book' },
      party_size: { type: 'number', description: 'Number of guests' },
    },
    required: ['floor', 'datetime', 'party_size'],
  },
}
