import { NextRequest, NextResponse } from 'next/server'
import { getAdminAuth } from '@/lib/firebase-admin'
import { cookies } from 'next/headers'

export async function POST(req: NextRequest) {
  const { idToken } = await req.json() as { idToken: string }
  if (!idToken) return NextResponse.json({ error: 'Missing idToken' }, { status: 400 })

  try {
    const adminAuth = getAdminAuth()
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
    console.error('[session] Cookie creation failed:', err)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}

export async function DELETE() {
  const cookieStore = await cookies()
  cookieStore.delete('__session')
  return NextResponse.json({ ok: true })
}
