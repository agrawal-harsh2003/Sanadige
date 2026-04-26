import { NextRequest, NextResponse } from 'next/server'

const ROLE_DEFAULTS: Record<string, string> = {
  manager: '/dashboard',
  chef:    '/dashboard/bookings',
  host:    '/dashboard/bookings',
  waiter:  '/dashboard/bookings',
}

const ROLE_ACCESS: Record<string, string[]> = {
  '/dashboard':        ['manager'],
  '/dashboard/guests': ['manager'],
  '/dashboard/bookings': ['manager', 'host', 'waiter', 'chef'],
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (pathname === '/login' || pathname === '/' || pathname.startsWith('/api')) {
    return NextResponse.next()
  }

  const sessionCookie = req.cookies.get('__session')?.value
  if (!sessionCookie) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  // Lightweight check — full verification happens in getSession() within pages
  // Just ensure cookie exists; server components re-verify with adminAuth
  const allowed = ROLE_ACCESS[pathname]
  if (!allowed) return NextResponse.next()

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next|api|favicon.ico).*)'],
}
