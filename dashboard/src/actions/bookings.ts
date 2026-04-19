'use server'
import { revalidatePath } from 'next/cache'
import { getSupabase } from '@/lib/supabase'
import { backendPost } from '@/lib/backend'

function generateRef() {
  return 'SND-' + Math.random().toString(36).substring(2, 8).toUpperCase()
}

export async function createBooking(data: {
  guest_name: string
  phone: string
  party_size: number
  datetime: string
  floor: string
  special_notes?: string
}) {
  const supabase = getSupabase()
  const booking_ref = generateRef()

  await supabase.from('bookings').insert({
    ...data,
    booking_ref,
    whatsapp_id: data.phone,
    status: 'confirmed',
  })

  await backendPost('/bookings/confirm', {
    phone: data.phone,
    guest_name: data.guest_name,
    booking_ref,
    datetime: data.datetime,
    party_size: data.party_size,
    floor: data.floor,
  }).catch(() => {})

  revalidatePath('/dashboard/bookings')
  revalidatePath('/dashboard')
}

export async function updateBookingStatus(
  id: string,
  status: 'confirmed' | 'seated' | 'no_show' | 'cancelled'
) {
  const supabase = getSupabase()
  await supabase.from('bookings').update({ status }).eq('id', id)
  revalidatePath('/dashboard/bookings')
  revalidatePath('/dashboard')
}
