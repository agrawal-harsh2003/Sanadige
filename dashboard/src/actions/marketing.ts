'use server'
import { revalidatePath } from 'next/cache'
import { getAdminDb } from '@/lib/firebase-admin'
import { getSession } from '@/lib/auth'
import { backendPost } from '@/lib/backend'

export async function sendCampaign(params: {
  name: string
  segment_type: string
  message: string
}): Promise<{ sent: number }> {
  const session = await getSession()
  if (!session || session.role !== 'manager') throw new Error('Unauthorized')

  const db = getAdminDb()

  // Build guest query by segment
  let query: FirebaseFirestore.Query = db.collection('guests').where('is_marketing_opted_in', '==', true)

  const now = new Date()
  if (params.segment_type === 'lapsed') {
    const cutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString()
    query = query.where('last_visit_at', '<', cutoff)
  } else if (params.segment_type === 'vip') {
    query = query.where('tier', '==', 'vip')
  } else if (params.segment_type === 'preferred') {
    query = query.where('tier', '==', 'preferred')
  } else if (params.segment_type === 'birthday') {
    // Filter in memory — Firestore can't do month/day range queries easily
  }

  const snap = await query.limit(500).get()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let guests = snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[]

  if (params.segment_type === 'birthday') {
    const soon = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(now.getTime() + i * 24 * 60 * 60 * 1000)
      return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    })
    guests = guests.filter(g => {
      if (!g.birthday) return false
      const mmdd = g.birthday.slice(5, 10)
      return soon.includes(mmdd)
    })
  }

  let sent = 0
  await Promise.allSettled(guests.map(async (g) => {
    const text = params.message.replace(/\{name\}/g, g.name ?? 'Guest')
    await backendPost('/bookings/whatsapp/send', { to: g.phone, text })
    sent++
  }))

  await db.collection('campaigns').add({
    name: params.name,
    segment_type: params.segment_type,
    message: params.message,
    sent_count: sent,
    status: 'sent',
    created_by: session.name,
    sent_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  })

  revalidatePath('/dashboard/marketing')
  return { sent }
}
