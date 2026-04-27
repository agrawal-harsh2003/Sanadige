import { cookies } from 'next/headers'
import { getAdminAuth, getAdminDb } from './firebase-admin'

export type Role = 'manager' | 'host'

export interface Session {
  uid: string
  phone: string
  name: string
  role: Role
}

export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get('__session')?.value
  if (!sessionCookie) return null

  try {
    const adminAuth = getAdminAuth()
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, false)
    const phone = decoded.phone_number as string | undefined
    if (!phone) return null

    const claims = decoded as Record<string, unknown>
    if (claims.role) {
      return {
        uid: decoded.uid,
        phone,
        name: (claims.name as string) ?? '',
        role: claims.role as Role,
      }
    }

    const phoneKey = phone.startsWith('+') ? phone.slice(1) : phone
    const db = getAdminDb()
    const snap = await db.collection('staff').where('phone', '==', phoneKey).limit(1).get()
    if (snap.empty) return null

    const staff = snap.docs[0].data()
    return {
      uid: decoded.uid,
      phone,
      name: staff.name ?? '',
      role: staff.role as Role,
    }
  } catch (err) {
    console.error('[auth] getSession error:', err)
    return null
  }
}
