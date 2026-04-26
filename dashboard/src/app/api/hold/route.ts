import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/firebase-admin'

function generateRef() {
  return 'SND-' + Math.random().toString(36).substring(2, 8).toUpperCase()
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
    const held_until = new Date(Date.now() + 15 * 60 * 1000).toISOString()

    const docRef = await db.collection('bookings').add({
      guest_name,
      phone,
      email: email ?? null,
      whatsapp_id: phone,
      party_size: Number(party_size),
      datetime,
      floor,
      occasion: occasion ?? null,
      special_notes: special_notes ?? null,
      booking_ref,
      status: 'pending',
      channel: 'website',
      held_until,
      deposit_status: 'pending',
      deposit_amount: 0,
      table_id: null,
      reminder_sent_at: null,
      dayof_sent_at: null,
      feedback_sent_at: null,
      checked_in_at: null,
      completed_at: null,
      no_show_at: null,
      created_at: new Date().toISOString(),
    })

    return NextResponse.json({ booking_id: docRef.id, booking_ref })
  } catch (err) {
    console.error('[hold] error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
