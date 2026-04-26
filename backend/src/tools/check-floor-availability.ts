import { db } from '../lib/firebase'

const FLOOR_CAPACITY: Record<string, number> = {
  terrace: 8,
  floor1: 12,
  floor2: 10,
  private: 1,
}

function normaliseIST(dt: string): string {
  if (/[+-]\d{2}:\d{2}$/.test(dt) || dt.endsWith('Z')) return dt
  return dt + '+05:30'
}

export async function checkFloorAvailability(
  floor: string,
  datetime: string,
): Promise<string> {
  const datetimeISO = normaliseIST(datetime)
  const requested = new Date(datetimeISO)
  const windowStart = new Date(requested.getTime() - 2 * 60 * 60 * 1000).toISOString()
  const windowEnd = new Date(requested.getTime() + 2 * 60 * 60 * 1000).toISOString()

  const snap = await db.collection('bookings')
    .where('floor', '==', floor)
    .where('status', 'in', ['confirmed', 'checked_in', 'seated'])
    .where('datetime', '>=', windowStart)
    .where('datetime', '<', windowEnd)
    .get()

  const capacity = FLOOR_CAPACITY[floor]
  if (capacity === undefined) return `Unknown floor: ${floor}`

  const booked = snap.size
  const remaining = capacity - booked

  if (remaining <= 0) {
    const alternatives = Object.keys(FLOOR_CAPACITY).filter(f => f !== floor).join(', ')
    return `The ${floor} is fully booked for that time. Suggest alternatives: ${alternatives}.`
  }

  return `The ${floor} is available. ${remaining} table(s) remaining. Proceed with create_booking.`
}

export const checkFloorAvailabilityDefinition = {
  name: 'check_floor_availability',
  description: 'Check if a floor has availability for a given datetime. Always call this just before create_booking.',
  input_schema: {
    type: 'object' as const,
    properties: {
      floor: { type: 'string', enum: ['terrace', 'floor1', 'floor2', 'private'], description: 'Which floor the guest chose' },
      datetime: { type: 'string', description: 'ISO 8601 datetime with IST offset, e.g. 2026-04-25T20:00:00+05:30' },
    },
    required: ['floor', 'datetime'],
  },
}
