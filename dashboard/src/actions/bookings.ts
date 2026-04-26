'use server'
import { revalidatePath } from 'next/cache'
import { getAdminDb } from '@/lib/firebase-admin'
import { backendPost } from '@/lib/backend'

function generateRef() {
  return 'SND-' + Math.random().toString(36).substring(2, 8).toUpperCase()
}

function revalidateAll() {
  revalidatePath('/dashboard/bookings')
  revalidatePath('/dashboard')
}

export async function createBooking(data: {
  guest_name: string
  phone: string
  party_size: number
  datetime: string
  floor: string
  special_notes?: string
  occasion?: string
  email?: string
}) {
  const db = getAdminDb()
  const booking_ref = generateRef()

  await db.collection('bookings').add({
    ...data,
    booking_ref,
    whatsapp_id: data.phone,
    status: 'confirmed',
    channel: 'phone',
    reminder_sent_at: null,
    dayof_sent_at: null,
    feedback_sent_at: null,
    checked_in_at: null,
    completed_at: null,
    no_show_at: null,
    created_at: new Date().toISOString(),
  })

  await backendPost('/bookings/confirm', {
    phone: data.phone,
    guest_name: data.guest_name,
    booking_ref,
    datetime: data.datetime,
    party_size: data.party_size,
    floor: data.floor,
  }).catch(() => {})

  revalidateAll()
}

export async function updateBookingStatus(
  id: string,
  status: 'confirmed' | 'seated' | 'no_show' | 'cancelled' | 'checked_in' | 'completed'
) {
  const db = getAdminDb()
  const updates: Record<string, unknown> = { status }
  if (status === 'checked_in') updates.checked_in_at = new Date().toISOString()
  if (status === 'completed') updates.completed_at = new Date().toISOString()
  if (status === 'no_show') updates.no_show_at = new Date().toISOString()

  await db.collection('bookings').doc(id).update(updates)
  revalidateAll()
}

export async function cancelBooking(id: string) {
  const db = getAdminDb()
  await db.collection('bookings').doc(id).update({ status: 'cancelled' })
  revalidateAll()
}

export async function assignTable(bookingId: string, tableId: string) {
  const db = getAdminDb()
  await db.collection('bookings').doc(bookingId).update({ table_id: tableId, status: 'seated' })
  revalidateAll()
}
