'use server'
import { revalidatePath } from 'next/cache'
import { getAdminDb } from '@/lib/firebase-admin'
import { getSession } from '@/lib/auth'

export async function addGuestNote(guestId: string, note: string) {
  const session = await getSession()
  if (!session) throw new Error('Unauthorized')
  const db = getAdminDb()
  await db.collection('guests').doc(guestId).collection('notes').add({
    note,
    added_by: session.name,
    created_at: new Date().toISOString(),
  })
  revalidatePath(`/dashboard/guests/${guestId}`)
}

export async function updateGuestTier(guestId: string, tier: 'standard' | 'preferred' | 'vip') {
  const db = getAdminDb()
  await db.collection('guests').doc(guestId).update({ tier })
  revalidatePath(`/dashboard/guests/${guestId}`)
  revalidatePath('/dashboard/guests')
}

export async function updateGuestPreferences(guestId: string, prefs: {
  dietary_notes?: string
  seating_preference?: string
}) {
  const db = getAdminDb()
  await db.collection('guests').doc(guestId).update(prefs)
  revalidatePath(`/dashboard/guests/${guestId}`)
}
