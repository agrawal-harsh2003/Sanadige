import { db } from '../lib/firebase'
import { FieldValue } from 'firebase-admin/firestore'

export interface Guest {
  id: string
  phone: string
  name: string
  whatsapp_id?: string
  email?: string
  dietary_notes?: string
  seating_preference?: string
  tier: 'standard' | 'preferred' | 'vip'
  visit_count: number
  last_visit_at?: string
  first_visit_at?: string
  is_marketing_opted_in: boolean
  created_at: string
}

export async function upsertGuest(params: {
  phone: string
  name: string
  whatsappId?: string
  email?: string
  occasion?: string
}): Promise<string> {
  const snap = await db.collection('guests').where('phone', '==', params.phone).limit(1).get()

  if (!snap.empty) {
    const doc = snap.docs[0]
    await doc.ref.update({
      name: params.name,
      ...(params.whatsappId ? { whatsapp_id: params.whatsappId } : {}),
      ...(params.email ? { email: params.email } : {}),
    })
    return doc.id
  }

  const now = new Date().toISOString()
  const ref = await db.collection('guests').add({
    phone: params.phone,
    name: params.name,
    whatsapp_id: params.whatsappId ?? params.phone,
    email: params.email ?? null,
    dietary_notes: null,
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

export async function incrementVisitCount(guestId: string): Promise<void> {
  await db.collection('guests').doc(guestId).update({
    visit_count: FieldValue.increment(1),
    last_visit_at: new Date().toISOString(),
  })
}

export async function getGuestByPhone(phone: string): Promise<Guest | null> {
  const snap = await db.collection('guests').where('phone', '==', phone).limit(1).get()
  if (snap.empty) return null
  return { id: snap.docs[0].id, ...snap.docs[0].data() } as Guest
}

export async function addGuestNote(guestId: string, note: string, addedBy: string): Promise<void> {
  await db.collection('guests').doc(guestId).collection('notes').add({
    note,
    added_by: addedBy,
    created_at: new Date().toISOString(),
  })
}
