'use server'
import { revalidatePath } from 'next/cache'
import { getAdminDb } from '@/lib/firebase-admin'
import { getSession } from '@/lib/auth'

export async function saveServiceConfig(config: {
  date: string
  cover_cap: number
  walkin_allocation_pct: number
  is_closed: boolean
  notes: string
}) {
  const session = await getSession()
  if (!session || session.role !== 'manager') throw new Error('Unauthorized')
  const db = getAdminDb()
  await db.collection('service_config').doc(config.date).set(config, { merge: true })
  revalidatePath('/dashboard/settings')
}

export async function getServiceConfigForDate(date: string) {
  const db = getAdminDb()
  const snap = await db.collection('service_config').doc(date).get()
  return snap.exists
    ? (snap.data() as { cover_cap: number; walkin_allocation_pct: number; is_closed: boolean; notes: string })
    : { cover_cap: 60, walkin_allocation_pct: 10, is_closed: false, notes: '' }
}
