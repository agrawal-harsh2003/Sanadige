import { db, adminAuth } from '../lib/firebase'
import { env } from '../env'

export type StaffRole = 'chef' | 'host' | 'manager' | 'waiter'

export interface StaffMember {
  id: string
  phone: string
  name: string
  role: StaffRole
  uid?: string
}

export async function listStaff(): Promise<StaffMember[]> {
  const snap = await db.collection('staff').orderBy('name').get()
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as StaffMember))
}

export async function getStaff(phone: string): Promise<StaffMember | null> {
  return getStaffByPhone(phone)
}

export async function getStaffByPhone(phone: string): Promise<StaffMember | null> {
  const snap = await db.collection('staff').where('phone', '==', phone).limit(1).get()
  if (snap.empty) return null
  return { id: snap.docs[0].id, ...snap.docs[0].data() } as StaffMember
}

export async function addStaff(params: {
  phone: string
  name: string
  role: StaffRole
}): Promise<StaffMember> {
  const e164 = params.phone.startsWith('+') ? params.phone : `+${params.phone}`
  let uid: string | undefined

  try {
    const user = await adminAuth.createUser({ phoneNumber: e164, displayName: params.name })
    uid = user.uid
    await adminAuth.setCustomUserClaims(uid, { role: params.role, name: params.name })
  } catch (err: unknown) {
    if ((err as { code?: string }).code === 'auth/phone-number-already-exists') {
      try {
        const existing = await adminAuth.getUserByPhoneNumber(e164)
        uid = existing.uid
        await adminAuth.setCustomUserClaims(uid, { role: params.role, name: params.name })
      } catch {}
    }
  }

  const phoneKey = params.phone.startsWith('+') ? params.phone.slice(1) : params.phone
  const ref = await db.collection('staff').add({ ...params, phone: phoneKey, uid })
  return { id: ref.id, ...params, phone: phoneKey, uid }
}

export async function removeStaff(phone: string): Promise<void> {
  const snap = await db.collection('staff').where('phone', '==', phone).get()
  for (const doc of snap.docs) {
    const data = doc.data()
    if (data.uid) {
      try { await adminAuth.setCustomUserClaims(data.uid, null) } catch {}
    }
    await doc.ref.delete()
  }
}

export async function seedManagerFromEnv(): Promise<void> {
  const phone = env.MANAGER_PHONE
  const name = env.MANAGER_NAME ?? 'Manager'
  if (!phone) return

  const existing = await getStaffByPhone(phone)
  if (existing) return

  await addStaff({ phone, name, role: 'manager' })
  console.log('[staff] Manager seeded from env:', phone)
}
