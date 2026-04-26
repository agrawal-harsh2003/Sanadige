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

export async function createWalkIn(data: {
  guest_name: string
  phone: string
  party_size: number
}): Promise<{ ok: boolean; floor?: string; table?: string }> {
  const db = getAdminDb()

  // Find an available table that fits the party
  const tablesSnap = await db.collection('tables')
    .where('is_active', '==', true)
    .where('capacity', '>=', data.party_size)
    .orderBy('capacity')
    .get()

  const istNow = new Date(Date.now() + 5.5 * 60 * 60 * 1000)
  const today = istNow.toISOString().split('T')[0]
  const activeSnap = await db.collection('bookings')
    .where('datetime', '>=', `${today}T00:00:00+05:30`)
    .where('datetime', '<=', `${today}T23:59:59+05:30`)
    .where('status', 'in', ['checked_in', 'seated'])
    .get()

  const occupiedTableIds = new Set(activeSnap.docs.map(d => d.data().table_id).filter(Boolean))

  const available = tablesSnap.docs.find(d => !occupiedTableIds.has(d.id))
  if (!available) return { ok: false }

  const tableData = available.data()
  const booking_ref = 'SND-' + Math.random().toString(36).substring(2, 8).toUpperCase()
  const now = istNow.toISOString()

  const bookingRef = await db.collection('bookings').add({
    ...data,
    booking_ref,
    whatsapp_id: data.phone,
    floor: tableData.floor,
    table_id: available.id,
    datetime: now,
    status: 'seated',
    channel: 'walkin',
    seated_at: now,
    checked_in_at: now,
    created_at: now,
    reminder_sent_at: null,
    dayof_sent_at: null,
    feedback_sent_at: null,
    completed_at: null,
    no_show_at: null,
    special_notes: null,
    occasion: null,
  })

  // Upsert guest profile
  await backendPost('/bookings/guest-upsert', {
    phone: data.phone,
    name: data.guest_name,
    channel: 'walkin',
  }).catch(() => {})

  revalidateAll()
  revalidatePath('/dashboard/floor')

  return { ok: true, floor: tableData.floor, table: tableData.table_number }
}
