import { NextRequest, NextResponse } from 'next/server'
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin'
import { cookies } from 'next/headers'

export async function POST(req: NextRequest) {
  const { idToken } = await req.json() as { idToken: string }
  if (!idToken) return NextResponse.json({ error: 'Missing idToken' }, { status: 400 })

  try {
    const adminAuth = getAdminAuth()
    const decoded = await adminAuth.verifyIdToken(idToken)
    const phone = decoded.phone_number
    if (!phone) return NextResponse.json({ error: 'No phone number on token' }, { status: 401 })

    // Look up staff (phone stored without leading +)
    const phoneKey = phone.startsWith('+') ? phone.slice(1) : phone
    const db = getAdminDb()
    const snap = await db.collection('staff').where('phone', '==', phoneKey).limit(1).get()
    if (snap.empty) return NextResponse.json({ error: 'Not registered as staff' }, { status: 403 })

    const staff = snap.docs[0].data()

    // Set custom claims so future tokens include role (avoids Firestore lookup in getSession)
    await adminAuth.setCustomUserClaims(decoded.uid, { role: staff.role, name: staff.name })

    const expiresIn = 60 * 60 * 24 * 5 * 1000
    const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn })

    const cookieStore = await cookies()
    cookieStore.set('__session', sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: expiresIn / 1000,
      path: '/',
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[session]', msg)
    return NextResponse.json({ error: msg }, { status: 401 })
  }
}

export async function DELETE() {
  const cookieStore = await cookies()
  cookieStore.delete('__session')
  return NextResponse.json({ ok: true })
}
