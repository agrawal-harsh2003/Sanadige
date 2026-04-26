import { db } from '../lib/firebase'

// Turn times in minutes by party size
function turnTime(partySize: number): number {
  if (partySize <= 2) return 90
  if (partySize <= 4) return 105
  if (partySize <= 6) return 120
  if (partySize <= 999) return 150
  return 180 // private
}

function normaliseIST(dt: string): string {
  if (/[+-]\d{2}:\d{2}$/.test(dt) || dt.endsWith('Z')) return dt
  return dt + '+05:30'
}

export async function checkFloorAvailability(
  floor: string,
  datetime: string,
  partySize = 2,
): Promise<string> {
  const datetimeISO = normaliseIST(datetime)
  const requested = new Date(datetimeISO)
  const date = datetimeISO.split('T')[0]

  // Load service config for cover cap
  const configSnap = await db.collection('service_config').doc(date).get()
  const config = configSnap.exists ? configSnap.data() : null
  if (config?.is_closed) return 'Service is closed on this date. Please suggest a different day.'

  const coverCap: number = config?.cover_cap ?? 60
  const walkinPct: number = config?.walkin_allocation_pct ?? 10
  const effectiveCap = Math.floor(coverCap * (1 - walkinPct / 100))

  const turn = turnTime(floor === 'private' ? 999 : partySize)
  // Window: existing bookings that would overlap with the requested slot
  const slotStart = requested.getTime()
  const slotEnd   = slotStart + turn * 60000

  const snap = await db.collection('bookings')
    .where('datetime', '>=', new Date(slotStart - 180 * 60000).toISOString())
    .where('datetime', '<',  new Date(slotEnd).toISOString())
    .where('status', 'in', ['confirmed', 'pending', 'checked_in', 'seated'])
    .get()

  // Count covers that overlap with our requested slot
  let totalCoversOverlap = 0
  let floorCoversOverlap = 0

  for (const doc of snap.docs) {
    const b = doc.data()
    const bStart = new Date(b.datetime).getTime()
    const bTurn  = turnTime(b.floor === 'private' ? 999 : (b.party_size ?? 2)) * 60000
    const bEnd   = bStart + bTurn
    // Check overlap
    if (bStart < slotEnd && bEnd > slotStart) {
      totalCoversOverlap += b.party_size ?? 0
      if (b.floor === floor) floorCoversOverlap += b.party_size ?? 0
    }
  }

  if (totalCoversOverlap + partySize > effectiveCap) {
    return `The restaurant is fully booked for that time (cover cap reached). Please suggest a time at least ${turn} minutes earlier or later.`
  }

  // Floor-level check: rough per-floor capacity
  const FLOOR_COVER_CAP: Record<string, number> = {
    terrace: 24, floor1: 24, floor2: 20, private: 14,
  }
  const floorCap = FLOOR_COVER_CAP[floor] ?? 20
  if (floorCoversOverlap + partySize > floorCap) {
    const alternatives = Object.keys(FLOOR_COVER_CAP).filter(f => f !== floor).join(', ')
    return `The ${floor} section is full for that time. Available alternatives: ${alternatives}. Please ask the guest for their preference.`
  }

  const remaining = effectiveCap - totalCoversOverlap
  return `The ${floor} is available at ${datetime} for ${partySize} guests. ${remaining} covers remaining restaurant-wide. Proceed with create_booking.`
}

export const checkFloorAvailabilityDefinition = {
  name: 'check_floor_availability',
  description: 'Check if a floor has availability for a given datetime and party size. Always call this just before create_booking.',
  input_schema: {
    type: 'object' as const,
    properties: {
      floor: { type: 'string', enum: ['terrace', 'floor1', 'floor2', 'private'], description: 'Which floor the guest chose' },
      datetime: { type: 'string', description: 'ISO 8601 datetime with IST offset, e.g. 2026-04-25T20:00:00+05:30' },
      party_size: { type: 'number', description: 'Number of guests in the party' },
    },
    required: ['floor', 'datetime'],
  },
}
