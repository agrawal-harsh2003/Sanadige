import { NextRequest, NextResponse } from 'next/server'
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin'
import { cookies } from 'next/headers'

export async function POST(req: NextRequest) {
  const { idToken } = await req.json() as { idToken: string }
  if (!idToken) return NextResponse.json({ error: 'Missing idToken' }, { status: 400 })

  try {
    const adminAuth = getAdminAuth()

    // Decode token to get phone number
    const decoded = await adminAuth.verifyIdToken(idToken)
    const phone = decoded.phone_number
    if (!phone) return NextResponse.json({ error: 'No phone number on token' }, { status: 401 })

    // Look up staff by phone (stored without leading +)
    const phoneKey = phone.startsWith('+') ? phone.slice(1) : phone
    const db = getAdminDb()
    console.log('[session] Looking up phone:', phoneKey, '| project:', process.env.FIREBASE_PROJECT_ID)
    const snap = await db.collection('staff').where('phone', '==', phoneKey).limit(1).get()
    console.log('[session] Staff snap size:', snap.size, '| docs:', snap.docs.map(d => d.data().phone))
    if (snap.empty) return NextResponse.json({ error: `Not registered as staff (searched: ${phoneKey})` }, { status: 403 })

    const staff = snap.docs[0].data()

    // Ensure custom claims are set (needed for getSession role check)
    if (!decoded.role) {
      await adminAuth.setCustomUserClaims(decoded.uid, { role: staff.role, name: staff.name })
    }

    const expiresIn = 60 * 60 * 24 * 5 * 1000 // 5 days in ms
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
    console.error('[session] Cookie creation failed:', msg)
    return NextResponse.json({ error: msg }, { status: 401 })
  }
}

export async function DELETE() {
  const cookieStore = await cookies()
  cookieStore.delete('__session')
  return NextResponse.json({ ok: true })
}
