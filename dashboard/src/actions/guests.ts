'use server'
import { revalidatePath } from 'next/cache'
import { getAdminDb } from '@/lib/firebase-admin'
import { getSession } from '@/lib/auth'

/**
 * Create or update a guest profile. Never deletes existing data — only fills in
 * missing fields. Returns the Firestore guest document ID.
 */
export async function upsertGuest(params: {
  phone: string
  name: string
  whatsapp_id?: string
  email?: string
  special_notes?: string | null
}): Promise<string> {
  const db = getAdminDb()
  const snap = await db.collection('guests').where('phone', '==', params.phone).limit(1).get()

  if (!snap.empty) {
    const doc = snap.docs[0]
    const existing = doc.data()
    const updates: Record<string, unknown> = { name: params.name }
    // Only fill in fields that are currently absent — never overwrite
    if (params.whatsapp_id && !existing.whatsapp_id) updates.whatsapp_id = params.whatsapp_id
    if (params.email && !existing.email) updates.email = params.email
    if (params.special_notes && !existing.dietary_notes) updates.dietary_notes = params.special_notes
    if (Object.keys(updates).length > 0) await doc.ref.update(updates)
    return doc.id
  }

  const now = new Date().toISOString()
  const ref = await db.collection('guests').add({
    phone: params.phone,
    name: params.name,
    whatsapp_id: params.whatsapp_id ?? params.phone,
    email: params.email ?? null,
    dietary_notes: params.special_notes ?? null,
    seating_preference: null,
    tier: 'standard',
    visit_count: 0,
    last_visit_at: null,
    first_visit_at: now,
    is_marketing_opted_in: true,
    created_at: now,
  })
  return ref.id
}

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
