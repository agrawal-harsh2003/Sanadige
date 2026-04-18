import { NextRequest, NextResponse } from 'next/server'
import { verifyJwt } from '@/lib/auth'

const ROLE_DEFAULTS: Record<string, string> = {
  manager: '/dashboard',
  chef: '/dashboard/catch',
  host: '/dashboard/bookings',
}

const ROLE_ACCESS: Record<string, string[]> = {
  '/dashboard': ['manager'],
  '/dashboard/catch': ['manager', 'chef'],
  '/dashboard/bookings': ['manager', 'host'],
  '/dashboard/floor': ['manager', 'host'],
  '/dashboard/staff': ['manager'],
  '/dashboard/analytics': ['manager'],
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (pathname === '/login' || pathname === '/') {
    return NextResponse.next()
  }

  const token = req.cookies.get('snd_session')?.value
  if (!token) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  const payload = await verifyJwt(token)
  if (!payload) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  const allowed = ROLE_ACCESS[pathname]
  if (allowed && !allowed.includes(payload.role)) {
    return NextResponse.redirect(new URL(ROLE_DEFAULTS[payload.role], req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next|api|favicon.ico).*)'],
}
