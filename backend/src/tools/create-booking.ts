import { supabase } from '../lib/supabase'

export interface BookingInput {
  guestName: string
  phone: string
  whatsappId: string
  partySize: number
  datetime: string
  floor: 'terrace' | 'floor1' | 'floor2' | 'private'
  specialNotes: string | null
}

function generateRef(): string {
  const n = Math.floor(1000 + Math.random() * 9000)
  return `SND-${n}`
}

export async function createBooking(input: BookingInput): Promise<string> {
  const { data, error } = await supabase
    .from('bookings')
    .insert([{
      booking_ref: generateRef(),
      guest_name: input.guestName,
      phone: input.phone,
      whatsapp_id: input.whatsappId,
      party_size: input.partySize,
      datetime: input.datetime,
      floor: input.floor,
      special_notes: input.specialNotes,
      status: 'confirmed',
    }])
    .select('booking_ref, guest_name, datetime, floor, party_size')
    .single()

  if (error) throw new Error(error.message)

  const localTime = new Date(data.datetime).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'full',
    timeStyle: 'short',
  })

  return `Booking confirmed! Ref: ${data.booking_ref}. ${data.guest_name}, ${data.party_size} guests on the ${data.floor}, ${localTime}.`
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
      party_size: { type: 'number' },
      datetime: { type: 'string', description: 'ISO 8601 datetime' },
      floor: { type: 'string', enum: ['terrace', 'floor1', 'floor2', 'private'] },
      special_notes: { type: 'string', nullable: true },
    },
    required: ['guest_name', 'phone', 'whatsapp_id', 'party_size', 'datetime', 'floor'],
  },
}
