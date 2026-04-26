import { db } from '../lib/firebase'
import { upsertGuest } from '../services/guests'
import { notifyStaffOfBooking } from '../services/reminder'

function generateRef(): string {
  return 'SND-' + Math.random().toString(36).substring(2, 8).toUpperCase()
}

function normaliseIST(dt: string): string {
  if (/[+-]\d{2}:\d{2}$/.test(dt) || dt.endsWith('Z')) return dt
  return dt + '+05:30'
}

export const createBookingDefinition = {
  name: 'create_booking',
  description: 'Create a confirmed reservation. Call this only after the customer has provided name, date/time, party size, and floor preference, and has confirmed the booking summary.',
  input_schema: {
    type: 'object' as const,
    properties: {
      guest_name: { type: 'string' },
      phone: { type: 'string', description: 'Customer phone number (same as sender)' },
      whatsapp_id: { type: 'string' },
      party_size: { type: 'string', description: 'Number of guests as a string, e.g. "4"' },
      datetime: { type: 'string', description: 'ISO 8601 datetime with IST offset, e.g. 2026-04-25T20:00:00+05:30' },
      floor: { type: 'string', enum: ['terrace', 'floor1', 'floor2', 'private'] },
      special_notes: { type: 'string', nullable: true },
      occasion: { type: 'string', nullable: true },
    },
    required: ['guest_name', 'phone', 'whatsapp_id', 'party_size', 'datetime', 'floor'],
  },
}

export async function createBooking(input: {
  guest_name: string
  phone: string
  whatsapp_id?: string
  party_size: string
  datetime: string
  floor: string
  special_notes?: string | null
  occasion?: string | null
}): Promise<string> {
  const booking_ref = generateRef()
  const datetimeISO = normaliseIST(input.datetime)
  const partySize = Number(input.party_size)
  const whatsappId = input.whatsapp_id ?? input.phone

  const guestId = await upsertGuest({
    phone: input.phone,
    name: input.guest_name,
    whatsappId,
    occasion: input.occasion ?? undefined,
  }).catch(() => null)

  await db.collection('bookings').add({
    booking_ref,
    guest_id: guestId ?? null,
    guest_name: input.guest_name,
    phone: input.phone,
    whatsapp_id: whatsappId,
    party_size: partySize,
    datetime: datetimeISO,
    floor: input.floor,
    special_notes: input.special_notes ?? null,
    occasion: input.occasion ?? null,
    status: 'confirmed',
    channel: 'whatsapp',
    reminder_sent_at: null,
    dayof_sent_at: null,
    feedback_sent_at: null,
    checked_in_at: null,
    completed_at: null,
    no_show_at: null,
    created_at: new Date().toISOString(),
  })

  const dt = new Date(datetimeISO)
  const istDt = new Date(dt.getTime() + 5.5 * 60 * 60 * 1000)
  const dateStr = istDt.toISOString().split('T')[0]
  const h = istDt.getUTCHours()
  const m = istDt.getUTCMinutes()
  const period = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  const timeStr = `${hour}:${m.toString().padStart(2, '0')} ${period}`

  notifyStaffOfBooking({
    guestName: input.guest_name,
    partySize,
    date: dateStr,
    time: timeStr,
    floor: input.floor,
    ref: booking_ref,
    createdBy: 'WhatsApp Bot',
  }).catch(() => {})

  return `BOOKING_SUCCESS|ref:${booking_ref}|name:${input.guest_name}|guests:${partySize}|floor:${input.floor}|date:${dateStr}|time:${timeStr}`
}
