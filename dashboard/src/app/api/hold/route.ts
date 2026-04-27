import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/firebase-admin'
import { backendPost } from '@/lib/backend'

function generateRef() {
  return 'SND-' + Math.random().toString(36).substring(2, 8).toUpperCase()
}

async function upsertGuest(db: FirebaseFirestore.Firestore, params: {
  phone: string; name: string; email?: string | null; special_notes?: string | null
}): Promise<string | null> {
  try {
    const snap = await db.collection('guests').where('phone', '==', params.phone).limit(1).get()
    if (!snap.empty) {
      const doc = snap.docs[0]
      const existing = doc.data()
      const updates: Record<string, unknown> = { name: params.name }
      if (params.email && !existing.email) updates.email = params.email
      if (params.special_notes && !existing.dietary_notes) updates.dietary_notes = params.special_notes
      await doc.ref.update(updates)
      return doc.id
    }
    const now = new Date().toISOString()
    const ref = await db.collection('guests').add({
      phone: params.phone,
      name: params.name,
      whatsapp_id: params.phone,
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
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { guest_name, phone, email, party_size, datetime, floor, occasion, special_notes } = body

    if (!guest_name || !phone || !party_size || !datetime || !floor) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const db = getAdminDb()
    const booking_ref = generateRef()

    const guest_id = await upsertGuest(db, { phone, name: guest_name, email, special_notes })

    await db.collection('bookings').add({
      guest_name,
      phone,
      email: email ?? null,
      whatsapp_id: phone,
      guest_id: guest_id ?? null,
      party_size: Number(party_size),
      datetime,
      floor,
      occasion: occasion ?? null,
      special_notes: special_notes ?? null,
      booking_ref,
      status: 'confirmed',
      channel: 'website',
      table_id: null,
      reminder_sent_at: null,
      dayof_sent_at: null,
      feedback_sent_at: null,
      checked_in_at: null,
      completed_at: null,
      no_show_at: null,
      created_at: new Date().toISOString(),
    })

    // Send WhatsApp confirmation — fire and forget, don't block the response
    backendPost('/bookings/confirm', {
      phone,
      guest_name,
      booking_ref,
      datetime,
      party_size: Number(party_size),
      floor,
    }).catch(err => console.error('[hold] confirm WhatsApp failed:', err))

    return NextResponse.json({ booking_id: null, booking_ref })
  } catch (err) {
    console.error('[hold] error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
