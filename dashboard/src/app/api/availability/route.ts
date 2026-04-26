import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/firebase-admin'

// Turn times in minutes by party size
function turnTime(partySize: number): number {
  if (partySize <= 2) return 90
  if (partySize <= 4) return 105
  if (partySize <= 6) return 120
  return 150
}

// Service slots: lunch 12:30–15:00, dinner 19:00–22:00 (last seating)
const LUNCH_SLOTS  = ['12:30', '13:00', '13:30', '14:00', '14:30', '15:00']
const DINNER_SLOTS = ['19:00', '19:30', '20:00', '20:30', '21:00', '21:30', '22:00']

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const date = searchParams.get('date')
  const partySizeStr = searchParams.get('party_size')
  const floor = searchParams.get('floor') ?? 'any'

  if (!date || !partySizeStr) {
    return NextResponse.json({ error: 'date and party_size required' }, { status: 400 })
  }

  const partySize = Number(partySizeStr)
  if (isNaN(partySize) || partySize < 1) {
    return NextResponse.json({ error: 'invalid party_size' }, { status: 400 })
  }

  const db = getAdminDb()

  // Check if service is closed for this date
  const configSnap = await db.collection('service_config').doc(date).get()
  const config = configSnap.exists ? configSnap.data() : null
  if (config?.is_closed) {
    return NextResponse.json({ slots: [], closed: true })
  }

  const coverCap: number = config?.cover_cap ?? 60
  const walkinHoldPct: number = config?.walkin_allocation_pct ?? 10
  const effectiveCap = Math.floor(coverCap * (1 - walkinHoldPct / 100))

  // Get confirmed/pending bookings for the day
  const snap = await db.collection('bookings')
    .where('datetime', '>=', `${date}T00:00:00+05:30`)
    .where('datetime', '<=', `${date}T23:59:59+05:30`)
    .where('status', 'in', ['confirmed', 'pending', 'checked_in', 'seated'])
    .get()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existing = snap.docs.map(d => d.data()) as any[]

  const turn = turnTime(partySize)

  // For each candidate slot, check if covers would be exceeded
  function slotISO(slot: string) {
    return `${date}T${slot}:00+05:30`
  }

  function coversAtSlot(slotIso: string): number {
    const slotMs = new Date(slotIso).getTime()
    return existing.reduce((sum, b) => {
      const bMs = new Date(b.datetime).getTime()
      const bTurn = turnTime(b.party_size ?? 2) * 60000
      // Booking overlaps if it starts before slot+turnTime and ends after slot
      if (bMs < slotMs + turn * 60000 && bMs + bTurn > slotMs) {
        return sum + (b.party_size ?? 0)
      }
      return sum
    }, 0)
  }

  const allSlots = [...LUNCH_SLOTS, ...DINNER_SLOTS]
  const availableSlots = allSlots.filter(slot => {
    const iso = slotISO(slot)
    // Don't offer slots in the past
    if (new Date(iso).getTime() < Date.now()) return false
    // Floor filter
    if (floor !== 'any') {
      const floorBookings = existing.filter(b => b.floor === floor)
      const floorCovers = floorBookings.reduce((s, b) => {
        const bMs = new Date(b.datetime).getTime()
        const bTurn = turnTime(b.party_size ?? 2) * 60000
        const slotMs = new Date(iso).getTime()
        if (bMs < slotMs + turn * 60000 && bMs + bTurn > slotMs) return s + (b.party_size ?? 0)
        return s
      }, 0)
      if (floorCovers + partySize > effectiveCap / 2) return false
    }
    return coversAtSlot(iso) + partySize <= effectiveCap
  })

  const service = (slot: string) => {
    const h = parseInt(slot.split(':')[0])
    return h < 17 ? 'lunch' : 'dinner'
  }

  return NextResponse.json({
    slots: availableSlots.map(slot => ({
      time: slot,
      iso: slotISO(slot),
      service: service(slot),
    })),
    closed: false,
  })
}
