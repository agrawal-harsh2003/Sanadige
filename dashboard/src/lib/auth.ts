import { cookies } from 'next/headers'
import { getAdminAuth } from './firebase-admin'

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
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true)
    const claims = decoded as Record<string, unknown>

    if (!claims.role) return null

    return {
      uid: decoded.uid,
      phone: (decoded.phone_number as string) ?? '',
      name: (claims.name as string) ?? '',
      role: claims.role as Role,
    }
  } catch {
    return null
  }
}
