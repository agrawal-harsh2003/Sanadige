'use server'
import { revalidatePath } from 'next/cache'
import { getAdminDb } from '@/lib/firebase-admin'
import { getSession } from '@/lib/auth'

export interface Table {
  id: string
  floor: string
  table_number: string
  capacity: number
  is_active: boolean
}

const DEFAULT_TABLES: Omit<Table, 'id'>[] = [
  // Terrace — 8 tables
  { floor: 'terrace', table_number: 'T1',  capacity: 2, is_active: true },
  { floor: 'terrace', table_number: 'T2',  capacity: 2, is_active: true },
  { floor: 'terrace', table_number: 'T3',  capacity: 4, is_active: true },
  { floor: 'terrace', table_number: 'T4',  capacity: 4, is_active: true },
  { floor: 'terrace', table_number: 'T5',  capacity: 4, is_active: true },
  { floor: 'terrace', table_number: 'T6',  capacity: 6, is_active: true },
  { floor: 'terrace', table_number: 'T7',  capacity: 6, is_active: true },
  { floor: 'terrace', table_number: 'T8',  capacity: 8, is_active: true },
  // Floor 1 — 8 tables
  { floor: 'floor1',  table_number: 'F1',  capacity: 2, is_active: true },
  { floor: 'floor1',  table_number: 'F2',  capacity: 2, is_active: true },
  { floor: 'floor1',  table_number: 'F3',  capacity: 4, is_active: true },
  { floor: 'floor1',  table_number: 'F4',  capacity: 4, is_active: true },
  { floor: 'floor1',  table_number: 'F5',  capacity: 4, is_active: true },
  { floor: 'floor1',  table_number: 'F6',  capacity: 6, is_active: true },
  { floor: 'floor1',  table_number: 'F7',  capacity: 6, is_active: true },
  { floor: 'floor1',  table_number: 'F8',  capacity: 8, is_active: true },
  // Floor 2 — 6 tables
  { floor: 'floor2',  table_number: 'S1',  capacity: 2, is_active: true },
  { floor: 'floor2',  table_number: 'S2',  capacity: 2, is_active: true },
  { floor: 'floor2',  table_number: 'S3',  capacity: 4, is_active: true },
  { floor: 'floor2',  table_number: 'S4',  capacity: 4, is_active: true },
  { floor: 'floor2',  table_number: 'S5',  capacity: 6, is_active: true },
  { floor: 'floor2',  table_number: 'S6',  capacity: 8, is_active: true },
  // Private — 2 rooms
  { floor: 'private', table_number: 'P1',  capacity: 10, is_active: true },
  { floor: 'private', table_number: 'P2',  capacity: 14, is_active: true },
]

export async function seedTables(): Promise<void> {
  const session = await getSession()
  if (!session || session.role !== 'manager') throw new Error('Unauthorized')
  const db = getAdminDb()
  const snap = await db.collection('tables').limit(1).get()
  if (!snap.empty) return // already seeded
  const batch = db.batch()
  DEFAULT_TABLES.forEach(t => {
    batch.set(db.collection('tables').doc(), t)
  })
  await batch.commit()
  revalidatePath('/dashboard/floor')
}

export async function getTables(): Promise<Table[]> {
  const db = getAdminDb()
  const snap = await db.collection('tables').where('is_active', '==', true).get()
  return snap.docs.map(d => ({ id: d.id, ...d.data() }) as Table)
}

export async function assignTableToBooking(bookingId: string, tableId: string): Promise<void> {
  const session = await getSession()
  if (!session) throw new Error('Unauthorized')
  const db = getAdminDb()
  await db.collection('bookings').doc(bookingId).update({
    table_id: tableId,
    status: 'seated',
    seated_at: new Date().toISOString(),
  })
  revalidatePath('/dashboard/floor')
  revalidatePath('/dashboard/bookings')
}
