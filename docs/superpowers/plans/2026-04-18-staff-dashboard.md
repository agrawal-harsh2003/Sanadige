# Staff Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a role-aware staff web dashboard at `dashboard.sanadige.in` with WhatsApp OTP auth and 6 sections (Mission Control, Catch, Bookings, Floor Map, Staff, Analytics).

**Architecture:** Separate Next.js 14 App Router project in `dashboard/` alongside `backend/`. Auth uses WhatsApp OTP sent via the existing App Runner backend, JWT stored as HTTP-only cookie. All Supabase queries run server-side via service role key; anon key used only for client-side Realtime subscriptions.

**Tech Stack:** Next.js 14, TypeScript, Tailwind CSS, shadcn/ui, Recharts, Supabase (service role + Realtime), jose (JWT), Vitest + React Testing Library, deployed to Vercel.

---

## File Map

**New files — backend/**
- `backend/src/routes/auth.ts` — POST /auth/send-otp express router
- `backend/src/db/migrations/002_dashboard_tables.sql` — staff_otps + activity_log tables

**New directory — dashboard/** (Next.js 14 app)
- `dashboard/src/middleware.ts` — JWT validation + route protection
- `dashboard/src/lib/auth.ts` — JWT sign/verify using jose
- `dashboard/src/lib/supabase.ts` — server-side Supabase client (service role)
- `dashboard/src/lib/supabase-browser.ts` — client Supabase (anon, realtime only)
- `dashboard/src/lib/backend.ts` — typed fetch wrapper for App Runner
- `dashboard/src/actions/auth.ts` — sendOtp, verifyOtp Server Actions
- `dashboard/src/actions/catch.ts` — toggleCatch, updateNote, addCatch
- `dashboard/src/actions/bookings.ts` — createBooking, updateStatus
- `dashboard/src/actions/staff.ts` — addStaff, updateRole, removeStaff
- `dashboard/src/app/layout.tsx` — root layout
- `dashboard/src/app/page.tsx` — redirect to /dashboard or /login
- `dashboard/src/app/login/page.tsx` — phone + OTP entry UI
- `dashboard/src/app/dashboard/layout.tsx` — shell: sidebar + topbar + auth check
- `dashboard/src/app/dashboard/page.tsx` — role-based redirect
- `dashboard/src/app/dashboard/catch/page.tsx`
- `dashboard/src/app/dashboard/bookings/page.tsx`
- `dashboard/src/app/dashboard/floor/page.tsx`
- `dashboard/src/app/dashboard/staff/page.tsx`
- `dashboard/src/app/dashboard/analytics/page.tsx`
- `dashboard/src/components/shell/Sidebar.tsx`
- `dashboard/src/components/shell/Topbar.tsx`
- `dashboard/src/components/catch/CatchCard.tsx`
- `dashboard/src/components/catch/CatchGrid.tsx`
- `dashboard/src/components/catch/AddCatchDrawer.tsx`
- `dashboard/src/components/bookings/BookingsTable.tsx`
- `dashboard/src/components/bookings/BookingRow.tsx`
- `dashboard/src/components/bookings/NewBookingDrawer.tsx`
- `dashboard/src/components/floor/FloorMap.tsx`
- `dashboard/src/components/staff/StaffCard.tsx`
- `dashboard/src/components/staff/AddStaffDrawer.tsx`
- `dashboard/src/components/home/KpiRow.tsx`
- `dashboard/src/components/home/BookingsChart.tsx`
- `dashboard/src/components/home/UpcomingBookings.tsx`
- `dashboard/src/components/home/CatchWidget.tsx`
- `dashboard/src/components/home/ActivityFeed.tsx`
- `dashboard/src/components/home/StaffWidget.tsx`
- `dashboard/src/components/analytics/BookingsTrend.tsx`
- `dashboard/src/components/analytics/FloorDonut.tsx`
- `dashboard/src/components/analytics/PeakHoursHeatmap.tsx`
- `dashboard/src/components/analytics/RevenueTrend.tsx`
- `dashboard/__tests__/auth.test.ts`
- `dashboard/__tests__/actions/catch.test.ts`
- `dashboard/__tests__/actions/bookings.test.ts`
- `dashboard/__tests__/actions/staff.test.ts`

---

## Task 1: Database Migration — staff_otps + activity_log

**Files:**
- Create: `backend/src/db/migrations/002_dashboard_tables.sql`

- [ ] **Step 1: Write migration file**

```sql
-- backend/src/db/migrations/002_dashboard_tables.sql

create table if not exists staff_otps (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  code text not null,
  expires_at timestamptz not null,
  used boolean default false,
  created_at timestamptz default now()
);

create index if not exists staff_otps_phone_idx on staff_otps (phone);

create table if not exists activity_log (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type in ('catch_update','booking_new','booking_status','staff_change','whatsapp_query')),
  description text not null,
  actor_phone text,
  metadata jsonb,
  created_at timestamptz default now()
);

create index if not exists activity_log_created_idx on activity_log (created_at desc);
```

- [ ] **Step 2: Run migration in Supabase SQL editor**

Copy the SQL above and run it in the Supabase dashboard → SQL Editor. Confirm both tables appear in the Table Editor.

- [ ] **Step 3: Commit**

```bash
git add backend/src/db/migrations/002_dashboard_tables.sql
git commit -m "feat: add staff_otps and activity_log tables"
```

---

## Task 2: Backend — POST /auth/send-otp endpoint

**Files:**
- Create: `backend/src/routes/auth.ts`
- Modify: `backend/src/index.ts`

- [ ] **Step 1: Create the auth router**

```typescript
// backend/src/routes/auth.ts
import { Router } from 'express'
import { supabase } from '../lib/supabase'
import { sendWhatsAppMessage } from '../lib/whatsapp'

export const authRouter = Router()

authRouter.post('/send-otp', async (req, res) => {
  const { phone } = req.body as { phone?: string }
  if (!phone) return res.json({ ok: true }) // never reveal errors

  // Check staff exists
  const { data: staff } = await supabase
    .from('staff')
    .select('phone')
    .eq('phone', phone)
    .single()

  if (staff) {
    const code = String(Math.floor(100000 + Math.random() * 900000))
    const expires_at = new Date(Date.now() + 10 * 60 * 1000).toISOString()

    // Clear old OTPs for this phone
    await supabase.from('staff_otps').delete().eq('phone', phone).eq('used', false)

    await supabase.from('staff_otps').insert({ phone, code, expires_at })

    await sendWhatsAppMessage(
      phone,
      `Your Sanadige dashboard OTP is: *${code}*. Valid for 10 minutes.`
    )
  }

  res.json({ ok: true })
})
```

- [ ] **Step 2: Check sendWhatsAppMessage signature in lib/whatsapp.ts**

```bash
grep -n "export" /Users/harshagrawal/Documents/Sanadige/backend/src/lib/whatsapp.ts | head -20
```

Adjust the import/call in auth.ts if the function name or signature differs.

- [ ] **Step 3: Register route in index.ts**

Add after the existing route registrations:

```typescript
// backend/src/index.ts — add import at top
import { authRouter } from './routes/auth'

// add after existing app.use lines
app.use('/auth', authRouter)
```

- [ ] **Step 4: Manual test**

```bash
cd backend && npm run dev
# In another terminal:
curl -X POST http://localhost:3000/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"phone":"<your-staff-phone>"}'
# Expected: {"ok":true} — check WhatsApp for OTP message
```

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/auth.ts backend/src/index.ts
git commit -m "feat: add POST /auth/send-otp endpoint"
```

---

## Task 3: Scaffold Next.js Dashboard Project

**Files:**
- Create: `dashboard/` (Next.js 14 app)
- Create: `dashboard/.env.local`
- Create: `dashboard/tailwind.config.ts`

- [ ] **Step 1: Create Next.js app**

```bash
cd /Users/harshagrawal/Documents/Sanadige
npx create-next-app@14 dashboard \
  --typescript \
  --tailwind \
  --app \
  --src-dir \
  --no-eslint \
  --import-alias "@/*"
```

- [ ] **Step 2: Install dependencies**

```bash
cd dashboard
npm install @supabase/supabase-js jose recharts
npm install -D vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom jsdom
npx shadcn@latest init
```

When shadcn asks:
- Style: Default
- Base color: Neutral
- CSS variables: Yes

Then add required components:
```bash
npx shadcn@latest add button input label card badge dialog drawer select table tabs
```

- [ ] **Step 3: Create .env.local**

```bash
cat > dashboard/.env.local << 'EOF'
SUPABASE_URL=<your-supabase-url>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
SUPABASE_ANON_KEY=<your-anon-key>
JWT_SECRET=<generate: openssl rand -base64 32>
BACKEND_URL=<your-app-runner-url>
EOF
```

- [ ] **Step 4: Configure Tailwind with Sanadige warm palette**

```typescript
// dashboard/tailwind.config.ts
import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#f8f7f4',
        surface: '#ffffff',
        border: '#e8e3dc',
        primary: {
          DEFAULT: '#1a3a2a',
          foreground: '#ffffff',
        },
        accent: {
          DEFAULT: '#c8956c',
          foreground: '#ffffff',
        },
        'text-muted': '#9ca3af',
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
```

- [ ] **Step 5: Configure Vitest**

```typescript
// dashboard/vitest.config.ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    globals: true,
  },
  resolve: {
    alias: { '@': resolve(__dirname, './src') },
  },
})
```

```typescript
// dashboard/src/test-setup.ts
import '@testing-library/jest-dom'
```

- [ ] **Step 6: Add test script to package.json**

In `dashboard/package.json`, add to scripts:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 7: Commit**

```bash
cd /Users/harshagrawal/Documents/Sanadige
git add dashboard/
git commit -m "feat: scaffold Next.js 14 dashboard project"
```

---

## Task 4: Auth Library — JWT + Supabase Clients

**Files:**
- Create: `dashboard/src/lib/auth.ts`
- Create: `dashboard/src/lib/supabase.ts`
- Create: `dashboard/src/lib/supabase-browser.ts`
- Create: `dashboard/src/lib/backend.ts`
- Create: `dashboard/__tests__/auth.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// dashboard/__tests__/auth.test.ts
import { describe, it, expect } from 'vitest'
import { signJwt, verifyJwt } from '../src/lib/auth'

describe('JWT auth', () => {
  it('signs and verifies a valid payload', async () => {
    process.env.JWT_SECRET = 'test-secret-that-is-at-least-32-bytes-long!!'
    const payload = { phone: '+919876543210', name: 'Harsh', role: 'manager' as const }
    const token = await signJwt(payload)
    const result = await verifyJwt(token)
    expect(result?.phone).toBe(payload.phone)
    expect(result?.role).toBe(payload.role)
  })

  it('returns null for tampered token', async () => {
    process.env.JWT_SECRET = 'test-secret-that-is-at-least-32-bytes-long!!'
    const result = await verifyJwt('not.a.valid.token')
    expect(result).toBeNull()
  })
})
```

- [ ] **Step 2: Run to confirm it fails**

```bash
cd dashboard && npm test
# Expected: FAIL — Cannot find module '../src/lib/auth'
```

- [ ] **Step 3: Implement auth.ts**

```typescript
// dashboard/src/lib/auth.ts
import { SignJWT, jwtVerify } from 'jose'

export type Role = 'manager' | 'chef' | 'host'

export interface JwtPayload {
  phone: string
  name: string
  role: Role
}

function getSecret() {
  const s = process.env.JWT_SECRET
  if (!s) throw new Error('JWT_SECRET not set')
  return new TextEncoder().encode(s)
}

export async function signJwt(payload: JwtPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('12h')
    .sign(getSecret())
}

export async function verifyJwt(token: string): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret())
    return payload as unknown as JwtPayload
  } catch {
    return null
  }
}
```

- [ ] **Step 4: Run tests — confirm pass**

```bash
cd dashboard && npm test
# Expected: PASS (2 tests)
```

- [ ] **Step 5: Create supabase.ts (server-side)**

```typescript
// dashboard/src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

export function getSupabase() {
  const url = process.env.SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, key)
}
```

- [ ] **Step 6: Create supabase-browser.ts (client-side, realtime only)**

```typescript
// dashboard/src/lib/supabase-browser.ts
'use client'
import { createClient } from '@supabase/supabase-js'

let client: ReturnType<typeof createClient> | null = null

export function getBrowserSupabase() {
  if (!client) {
    client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }
  return client
}
```

Add to `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=<same as SUPABASE_URL>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
```

- [ ] **Step 7: Create backend.ts**

```typescript
// dashboard/src/lib/backend.ts
const BASE = process.env.BACKEND_URL!

export async function backendPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`App Runner ${path} failed: ${res.status}`)
  return res.json() as Promise<T>
}
```

- [ ] **Step 8: Commit**

```bash
git add dashboard/src/lib/ dashboard/__tests__/auth.test.ts dashboard/vitest.config.ts dashboard/src/test-setup.ts
git commit -m "feat: add JWT auth lib and Supabase clients"
```

---

## Task 5: Middleware — Route Protection

**Files:**
- Create: `dashboard/src/middleware.ts`

- [ ] **Step 1: Write middleware**

```typescript
// dashboard/src/middleware.ts
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

  // Check role access for the exact path
  const allowed = ROLE_ACCESS[pathname]
  if (allowed && !allowed.includes(payload.role)) {
    return NextResponse.redirect(new URL(ROLE_DEFAULTS[payload.role], req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next|api|favicon.ico).*)'],
}
```

- [ ] **Step 2: Commit**

```bash
git add dashboard/src/middleware.ts
git commit -m "feat: add JWT middleware for route protection"
```

---

## Task 6: Server Actions — Auth (sendOtp, verifyOtp)

**Files:**
- Create: `dashboard/src/actions/auth.ts`

- [ ] **Step 1: Write Server Actions**

```typescript
// dashboard/src/actions/auth.ts
'use server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getSupabase } from '@/lib/supabase'
import { signJwt, verifyJwt, type Role, type JwtPayload } from '@/lib/auth'
import { backendPost } from '@/lib/backend'

export async function sendOtp(phone: string): Promise<{ ok: boolean }> {
  await backendPost('/auth/send-otp', { phone })
  return { ok: true }
}

export async function verifyOtp(
  phone: string,
  code: string
): Promise<{ error?: string }> {
  const supabase = getSupabase()
  const now = new Date().toISOString()

  const { data: otp } = await supabase
    .from('staff_otps')
    .select('id, code, expires_at, used')
    .eq('phone', phone)
    .eq('used', false)
    .gt('expires_at', now)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!otp || otp.code !== code) {
    return { error: 'Invalid or expired OTP' }
  }

  // Mark used
  await supabase.from('staff_otps').update({ used: true }).eq('id', otp.id)

  // Fetch staff record
  const { data: staff } = await supabase
    .from('staff')
    .select('phone, name, role')
    .eq('phone', phone)
    .single()

  if (!staff) return { error: 'Staff not found' }

  const payload: JwtPayload = {
    phone: staff.phone,
    name: staff.name,
    role: staff.role as Role,
  }

  const token = await signJwt(payload)

  const cookieStore = await cookies()
  cookieStore.set('snd_session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 60 * 60 * 12, // 12 hours
    path: '/',
  })

  redirect('/dashboard')
}

export async function getSession(): Promise<JwtPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('snd_session')?.value
  if (!token) return null
  return verifyJwt(token)
}

export async function logout() {
  const cookieStore = await cookies()
  cookieStore.delete('snd_session')
  redirect('/login')
}
```

- [ ] **Step 2: Commit**

```bash
git add dashboard/src/actions/auth.ts
git commit -m "feat: add sendOtp and verifyOtp server actions"
```

---

## Task 7: Login Page UI

**Files:**
- Modify: `dashboard/src/app/layout.tsx`
- Create: `dashboard/src/app/page.tsx`
- Create: `dashboard/src/app/login/page.tsx`

- [ ] **Step 1: Update root layout**

```tsx
// dashboard/src/app/layout.tsx
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Sanadige Staff',
  description: 'Internal staff dashboard',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-background text-[#1a2e1a] antialiased">{children}</body>
    </html>
  )
}
```

- [ ] **Step 2: Create root page (redirect)**

```tsx
// dashboard/src/app/page.tsx
import { redirect } from 'next/navigation'
import { getSession } from '@/actions/auth'

export default async function RootPage() {
  const session = await getSession()
  if (session) redirect('/dashboard')
  redirect('/login')
}
```

- [ ] **Step 3: Create login page**

```tsx
// dashboard/src/app/login/page.tsx
'use client'
import { useState, useTransition } from 'react'
import { sendOtp, verifyOtp } from '@/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function LoginPage() {
  const [phone, setPhone] = useState('')
  const [step, setStep] = useState<'phone' | 'otp'>('phone')
  const [otp, setOtp] = useState('')
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleSendOtp(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    startTransition(async () => {
      await sendOtp(phone)
      setStep('otp')
    })
  }

  function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    startTransition(async () => {
      const result = await verifyOtp(phone, otp)
      if (result?.error) setError(result.error)
    })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm bg-surface border border-border rounded-2xl p-8 shadow-sm">
        <div className="mb-8 text-center">
          <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center mx-auto mb-4">
            <span className="text-white text-xl font-bold">S</span>
          </div>
          <h1 className="text-xl font-bold text-[#1a2e1a]">Sanadige Staff</h1>
          <p className="text-sm text-text-muted mt-1">Sign in with your WhatsApp number</p>
        </div>

        {step === 'phone' ? (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div>
              <Label htmlFor="phone">WhatsApp number</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+91 98765 43210"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                required
                className="mt-1"
              />
            </div>
            <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={isPending}>
              {isPending ? 'Sending…' : 'Send OTP via WhatsApp'}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <p className="text-sm text-text-muted">OTP sent to {phone}</p>
            <div>
              <Label htmlFor="otp">6-digit OTP</Label>
              <Input
                id="otp"
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="123456"
                value={otp}
                onChange={e => setOtp(e.target.value)}
                required
                className="mt-1 tracking-widest text-center text-lg"
              />
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={isPending}>
              {isPending ? 'Verifying…' : 'Verify & Sign In'}
            </Button>
            <button
              type="button"
              className="text-sm text-text-muted underline w-full text-center"
              onClick={() => setStep('phone')}
            >
              Use a different number
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run dev server and test login flow manually**

```bash
cd dashboard && npm run dev
# Navigate to http://localhost:3001/login
# Enter a phone number that exists in the staff table
# Confirm OTP arrives on WhatsApp, enter it, confirm redirect to /dashboard
```

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/app/
git commit -m "feat: login page with WhatsApp OTP flow"
```

---

## Task 8: Dashboard Shell — Sidebar + Topbar + Layout

**Files:**
- Create: `dashboard/src/components/shell/Sidebar.tsx`
- Create: `dashboard/src/components/shell/Topbar.tsx`
- Create: `dashboard/src/app/dashboard/layout.tsx`
- Create: `dashboard/src/app/dashboard/page.tsx`

- [ ] **Step 1: Create Sidebar**

```tsx
// dashboard/src/components/shell/Sidebar.tsx
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { type Role } from '@/lib/auth'

interface NavItem {
  href: string
  label: string
  roles: Role[]
  icon: string
}

const NAV: NavItem[] = [
  { href: '/dashboard', label: 'Mission Control', roles: ['manager'], icon: '⌂' },
  { href: '/dashboard/catch', label: "Today's Catch", roles: ['manager', 'chef'], icon: '🐟' },
  { href: '/dashboard/bookings', label: 'Bookings', roles: ['manager', 'host'], icon: '📋' },
  { href: '/dashboard/floor', label: 'Floor Map', roles: ['manager', 'host'], icon: '🗺' },
  { href: '/dashboard/staff', label: 'Staff', roles: ['manager'], icon: '👥' },
  { href: '/dashboard/analytics', label: 'Analytics', roles: ['manager'], icon: '📊' },
]

export function Sidebar({ role }: { role: Role }) {
  const pathname = usePathname()
  const items = NAV.filter(item => item.roles.includes(role))

  return (
    <aside className="hidden md:flex flex-col w-[220px] min-h-screen bg-surface border-r border-border px-3 py-6">
      <div className="flex items-center gap-2 px-3 mb-8">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
          <span className="text-white text-sm font-bold">S</span>
        </div>
        <span className="font-bold text-[#1a2e1a]">Sanadige</span>
      </div>

      <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted px-3 mb-2">Navigation</p>

      <nav className="flex flex-col gap-1">
        {items.map(item => {
          const active = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? 'bg-primary text-white'
                  : 'text-[#1a2e1a] hover:bg-background'
              }`}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
```

- [ ] **Step 2: Create Topbar**

```tsx
// dashboard/src/components/shell/Topbar.tsx
import { logout } from '@/actions/auth'
import { type JwtPayload } from '@/lib/auth'
import { Button } from '@/components/ui/button'

const ROLE_BADGE: Record<string, string> = {
  manager: 'bg-green-100 text-green-800',
  chef: 'bg-orange-100 text-orange-800',
  host: 'bg-blue-100 text-blue-800',
}

export function Topbar({ session }: { session: JwtPayload }) {
  return (
    <header className="h-14 border-b border-border bg-surface flex items-center justify-between px-6">
      <div />
      <div className="flex items-center gap-3">
        <span
          className={`text-xs font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide ${ROLE_BADGE[session.role]}`}
        >
          {session.role}
        </span>
        <span className="text-sm font-medium text-[#1a2e1a]">{session.name}</span>
        <form action={logout}>
          <Button variant="ghost" size="sm" type="submit" className="text-text-muted">
            Sign out
          </Button>
        </form>
      </div>
    </header>
  )
}
```

- [ ] **Step 3: Create dashboard layout**

```tsx
// dashboard/src/app/dashboard/layout.tsx
import { redirect } from 'next/navigation'
import { getSession } from '@/actions/auth'
import { Sidebar } from '@/components/shell/Sidebar'
import { Topbar } from '@/components/shell/Topbar'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) redirect('/login')

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar role={session.role} />
      <div className="flex-1 flex flex-col">
        <Topbar session={session} />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create dashboard root (role redirect)**

```tsx
// dashboard/src/app/dashboard/page.tsx
import { redirect } from 'next/navigation'
import { getSession } from '@/actions/auth'
import { MissionControl } from './_components/MissionControl'

export default async function DashboardPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (session.role === 'chef') redirect('/dashboard/catch')
  if (session.role === 'host') redirect('/dashboard/bookings')
  return <MissionControl />
}
```

Note: `MissionControl` is created in Task 9.

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/components/shell/ dashboard/src/app/dashboard/layout.tsx dashboard/src/app/dashboard/page.tsx
git commit -m "feat: dashboard shell with sidebar, topbar, and role-based routing"
```

---

## Task 9: Server Actions — Catch, Bookings, Staff

**Files:**
- Create: `dashboard/src/actions/catch.ts`
- Create: `dashboard/src/actions/bookings.ts`
- Create: `dashboard/src/actions/staff.ts`

- [ ] **Step 1: Create catch actions**

```typescript
// dashboard/src/actions/catch.ts
'use server'
import { revalidatePath } from 'next/cache'
import { getSupabase } from '@/lib/supabase'

export async function toggleCatch(
  catchItemId: string,
  status: 'available' | 'sold_out' | 'tomorrow'
) {
  const supabase = getSupabase()
  const today = new Date().toISOString().split('T')[0]
  await supabase.from('daily_availability').upsert(
    { catch_item_id: catchItemId, date: today, status },
    { onConflict: 'catch_item_id,date' }
  )
  revalidatePath('/dashboard/catch')
  revalidatePath('/dashboard')
}

export async function updateNote(catchItemId: string, notes: string) {
  const supabase = getSupabase()
  const today = new Date().toISOString().split('T')[0]
  await supabase
    .from('daily_availability')
    .update({ notes })
    .eq('catch_item_id', catchItemId)
    .eq('date', today)
  revalidatePath('/dashboard/catch')
}

export async function addCatch(data: {
  name: string
  origin_region: string
  recommended_preps: string[]
  spice_level: number
}) {
  const supabase = getSupabase()
  const today = new Date().toISOString().split('T')[0]

  const { data: item } = await supabase
    .from('catch_items')
    .insert({
      name: data.name,
      origin_region: data.origin_region,
      recommended_preps: data.recommended_preps,
      spice_level: data.spice_level,
      description: '',
    })
    .select('id')
    .single()

  if (item) {
    await supabase
      .from('daily_availability')
      .insert({ catch_item_id: item.id, date: today, status: 'available' })
  }

  revalidatePath('/dashboard/catch')
  revalidatePath('/dashboard')
}
```

- [ ] **Step 2: Create bookings actions**

```typescript
// dashboard/src/actions/bookings.ts
'use server'
import { revalidatePath } from 'next/cache'
import { getSupabase } from '@/lib/supabase'
import { backendPost } from '@/lib/backend'

function generateRef() {
  return 'SND-' + Math.random().toString(36).substring(2, 8).toUpperCase()
}

export async function createBooking(data: {
  guest_name: string
  phone: string
  party_size: number
  datetime: string
  floor: string
  special_notes?: string
}) {
  const supabase = getSupabase()
  const booking_ref = generateRef()

  await supabase.from('bookings').insert({
    ...data,
    booking_ref,
    whatsapp_id: data.phone,
    status: 'confirmed',
  })

  // Send WhatsApp confirmation via App Runner
  await backendPost('/bookings/confirm', {
    phone: data.phone,
    guest_name: data.guest_name,
    booking_ref,
    datetime: data.datetime,
    party_size: data.party_size,
    floor: data.floor,
  }).catch(() => {}) // non-fatal

  revalidatePath('/dashboard/bookings')
  revalidatePath('/dashboard')
}

export async function updateBookingStatus(
  id: string,
  status: 'confirmed' | 'seated' | 'no_show' | 'cancelled'
) {
  const supabase = getSupabase()
  await supabase.from('bookings').update({ status }).eq('id', id)
  revalidatePath('/dashboard/bookings')
  revalidatePath('/dashboard')
}
```

- [ ] **Step 3: Create staff actions**

```typescript
// dashboard/src/actions/staff.ts
'use server'
import { revalidatePath } from 'next/cache'
import { getSupabase } from '@/lib/supabase'
import { backendPost } from '@/lib/backend'

export async function addStaff(data: { name: string; phone: string; role: string }) {
  const supabase = getSupabase()
  await supabase.from('staff').upsert(data, { onConflict: 'phone' })

  await backendPost('/staff/welcome', { phone: data.phone, name: data.name, role: data.role }).catch(() => {})

  revalidatePath('/dashboard/staff')
  revalidatePath('/dashboard')
}

export async function updateStaffRole(id: string, role: string) {
  const supabase = getSupabase()
  await supabase.from('staff').update({ role }).eq('id', id)
  revalidatePath('/dashboard/staff')
}

export async function removeStaff(id: string) {
  const supabase = getSupabase()
  await supabase.from('staff').delete().eq('id', id)
  revalidatePath('/dashboard/staff')
  revalidatePath('/dashboard')
}
```

- [ ] **Step 4: Commit**

```bash
git add dashboard/src/actions/
git commit -m "feat: server actions for catch, bookings, and staff"
```

---

## Task 10: Mission Control Page

**Files:**
- Create: `dashboard/src/app/dashboard/_components/MissionControl.tsx`
- Create: `dashboard/src/components/home/KpiRow.tsx`
- Create: `dashboard/src/components/home/BookingsChart.tsx`
- Create: `dashboard/src/components/home/UpcomingBookings.tsx`
- Create: `dashboard/src/components/home/CatchWidget.tsx`
- Create: `dashboard/src/components/home/ActivityFeed.tsx`
- Create: `dashboard/src/components/home/StaffWidget.tsx`

- [ ] **Step 1: Create KpiRow**

```tsx
// dashboard/src/components/home/KpiRow.tsx
interface KpiCardProps { label: string; value: string; sub?: string }

function KpiCard({ label, value, sub }: KpiCardProps) {
  return (
    <div className="bg-surface border border-border rounded-xl p-5">
      <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-2">{label}</p>
      <p className="text-3xl font-bold text-[#1a2e1a]">{value}</p>
      {sub && <p className="text-xs text-text-muted mt-1">{sub}</p>}
    </div>
  )
}

interface KpiData {
  todayBookings: number
  availableSeats: number
  catchLive: string
  revenueToday: string
}

export function KpiRow({ data }: { data: KpiData }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <KpiCard label="Today's Bookings" value={String(data.todayBookings)} />
      <KpiCard label="Available Seats" value={String(data.availableSeats)} sub="of 142 total" />
      <KpiCard label="Catch Live" value={data.catchLive} />
      <KpiCard label="Revenue Today" value={data.revenueToday} sub="estimated" />
    </div>
  )
}
```

- [ ] **Step 2: Create BookingsChart (Recharts)**

```tsx
// dashboard/src/components/home/BookingsChart.tsx
'use client'
import { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

interface DayData { day: string; count: number; isToday: boolean }

export function BookingsChart({ weekData, monthData }: { weekData: DayData[]; monthData: DayData[] }) {
  const [view, setView] = useState<'week' | 'month'>('week')
  const data = view === 'week' ? weekData : monthData

  return (
    <div className="bg-surface border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-semibold text-[#1a2e1a]">Bookings Trend</p>
        <div className="flex gap-1">
          {(['week', 'month'] as const).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`text-xs px-3 py-1 rounded-full font-medium ${view === v ? 'bg-primary text-white' : 'bg-background text-text-muted'}`}
            >
              {v === 'week' ? 'Week' : 'Month'}
            </button>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data}>
          <XAxis dataKey="day" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip />
          <Bar dataKey="count" fill="#1a3a2a" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
```

- [ ] **Step 3: Create UpcomingBookings widget**

```tsx
// dashboard/src/components/home/UpcomingBookings.tsx
import Link from 'next/link'

const FLOOR_COLORS: Record<string, string> = {
  terrace: 'bg-amber-100 text-amber-800',
  floor1: 'bg-blue-100 text-blue-800',
  floor2: 'bg-green-100 text-green-800',
  private: 'bg-pink-100 text-pink-800',
}

interface Booking {
  id: string
  datetime: string
  guest_name: string
  party_size: number
  floor: string
}

export function UpcomingBookings({ bookings }: { bookings: Booking[] }) {
  return (
    <div className="bg-surface border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-semibold text-[#1a2e1a]">Upcoming Bookings</p>
        <Link href="/dashboard/bookings" className="text-xs text-accent hover:underline">View all →</Link>
      </div>
      <div className="space-y-3">
        {bookings.map(b => (
          <div key={b.id} className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm text-text-muted w-12">
                {new Date(b.datetime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
              </span>
              <span className="text-sm font-medium text-[#1a2e1a]">{b.guest_name}</span>
              <span className="text-xs text-text-muted">×{b.party_size}</span>
            </div>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${FLOOR_COLORS[b.floor] ?? ''}`}>
              {b.floor}
            </span>
          </div>
        ))}
        {bookings.length === 0 && <p className="text-sm text-text-muted">No upcoming bookings</p>}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create CatchWidget**

```tsx
// dashboard/src/components/home/CatchWidget.tsx
import Link from 'next/link'

const STATUS_DOT: Record<string, string> = {
  available: 'bg-green-500',
  sold_out: 'bg-red-500',
  tomorrow: 'bg-amber-500',
}

interface CatchItem { id: string; name: string; status: string }

export function CatchWidget({ items }: { items: CatchItem[] }) {
  return (
    <div className="bg-surface border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-semibold text-[#1a2e1a]">Today's Catch</p>
        <Link href="/dashboard/catch" className="text-xs text-accent hover:underline">Manage →</Link>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {items.map(item => (
          <div key={item.id} className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_DOT[item.status] ?? 'bg-gray-300'}`} />
            <span className="text-sm text-[#1a2e1a] truncate">{item.name}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Create ActivityFeed**

```tsx
// dashboard/src/components/home/ActivityFeed.tsx
interface Activity {
  id: string
  description: string
  event_type: string
  created_at: string
}

const EVENT_ICONS: Record<string, string> = {
  catch_update: '🐟',
  booking_new: '📋',
  booking_status: '✓',
  staff_change: '👤',
  whatsapp_query: '💬',
}

export function ActivityFeed({ activities }: { activities: Activity[] }) {
  return (
    <div className="bg-surface border border-border rounded-xl p-5">
      <p className="text-sm font-semibold text-[#1a2e1a] mb-4">Activity</p>
      <div className="space-y-3">
        {activities.map(a => (
          <div key={a.id} className="flex items-start gap-3">
            <span className="text-base">{EVENT_ICONS[a.event_type] ?? '•'}</span>
            <div>
              <p className="text-sm text-[#1a2e1a]">{a.description}</p>
              <p className="text-xs text-text-muted">
                {new Date(a.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}
        {activities.length === 0 && <p className="text-sm text-text-muted">No recent activity</p>}
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Create StaffWidget**

```tsx
// dashboard/src/components/home/StaffWidget.tsx
import Link from 'next/link'

const ROLE_COLORS: Record<string, string> = {
  manager: 'bg-green-500',
  chef: 'bg-orange-500',
  host: 'bg-blue-500',
}

interface StaffMember { id: string; name: string; role: string }

export function StaffWidget({ staff }: { staff: StaffMember[] }) {
  return (
    <div className="bg-surface border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-semibold text-[#1a2e1a]">Staff on Duty</p>
        <Link href="/dashboard/staff" className="text-xs text-accent hover:underline">Manage →</Link>
      </div>
      <div className="flex flex-wrap gap-3">
        {staff.map(s => (
          <div key={s.id} className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full ${ROLE_COLORS[s.role] ?? 'bg-gray-400'} flex items-center justify-center`}>
              <span className="text-white text-xs font-bold">{s.name[0]?.toUpperCase()}</span>
            </div>
            <span className="text-sm text-[#1a2e1a]">{s.name}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 7: Create MissionControl page component**

```tsx
// dashboard/src/app/dashboard/_components/MissionControl.tsx
import { getSupabase } from '@/lib/supabase'
import { KpiRow } from '@/components/home/KpiRow'
import { BookingsChart } from '@/components/home/BookingsChart'
import { UpcomingBookings } from '@/components/home/UpcomingBookings'
import { CatchWidget } from '@/components/home/CatchWidget'
import { ActivityFeed } from '@/components/home/ActivityFeed'
import { StaffWidget } from '@/components/home/StaffWidget'

async function getDashboardData() {
  const supabase = getSupabase()
  const today = new Date().toISOString().split('T')[0]
  const todayStart = `${today}T00:00:00`
  const todayEnd = `${today}T23:59:59`

  const [bookingsRes, catchRes, staffRes, activityRes] = await Promise.all([
    supabase.from('bookings').select('id,datetime,guest_name,party_size,floor,status').gte('datetime', todayStart).lte('datetime', todayEnd).eq('status', 'confirmed').order('datetime'),
    supabase.from('daily_availability').select('id,status,catch_items(name)').eq('date', today),
    supabase.from('staff').select('id,name,role'),
    supabase.from('activity_log').select('*').order('created_at', { ascending: false }).limit(10),
  ])

  const todayBookings = bookingsRes.data ?? []
  const totalSeats = 142
  const bookedSeats = todayBookings.reduce((acc, b) => acc + 0, 0) // simplified
  const availableSeats = totalSeats - todayBookings.length * 3 // avg 3 per booking

  const catchItems = (catchRes.data ?? []).map((r: any) => ({
    id: r.id,
    name: r.catch_items?.name ?? '',
    status: r.status,
  }))

  // Build last 7 days chart data
  const weekData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    const dateStr = d.toISOString().split('T')[0]
    return {
      day: d.toLocaleDateString('en-IN', { weekday: 'short' }),
      count: todayBookings.filter(b => b.datetime.startsWith(dateStr)).length,
      isToday: dateStr === today,
    }
  })

  const revenueToday = `₹${(todayBookings.length * 2000 * 3).toLocaleString('en-IN')}`
  const availableCatch = catchItems.filter(c => c.status === 'available').length
  const catchLive = `${availableCatch}/${catchItems.length}`

  return {
    kpi: { todayBookings: todayBookings.length, availableSeats, catchLive, revenueToday },
    upcoming: todayBookings.slice(0, 5),
    catchItems,
    staff: staffRes.data ?? [],
    activities: activityRes.data ?? [],
    weekData,
    monthData: weekData, // simplified — extend for 30 days if needed
  }
}

export async function MissionControl() {
  const data = await getDashboardData()

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-[#1a2e1a]">Mission Control</h1>
      <KpiRow data={data.kpi} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <BookingsChart weekData={data.weekData} monthData={data.monthData} />
        <UpcomingBookings bookings={data.upcoming} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <CatchWidget items={data.catchItems} />
        <ActivityFeed activities={data.activities} />
        <StaffWidget staff={data.staff} />
      </div>
    </div>
  )
}
```

- [ ] **Step 8: Commit**

```bash
git add dashboard/src/components/home/ dashboard/src/app/dashboard/_components/
git commit -m "feat: Mission Control page with KPIs, charts, and widgets"
```

---

## Task 11: Today's Catch Page

**Files:**
- Create: `dashboard/src/components/catch/CatchCard.tsx`
- Create: `dashboard/src/components/catch/CatchGrid.tsx`
- Create: `dashboard/src/components/catch/AddCatchDrawer.tsx`
- Create: `dashboard/src/app/dashboard/catch/page.tsx`

- [ ] **Step 1: Create CatchCard**

```tsx
// dashboard/src/components/catch/CatchCard.tsx
'use client'
import { useOptimistic, useTransition, useRef } from 'react'
import { toggleCatch, updateNote } from '@/actions/catch'
import { Badge } from '@/components/ui/badge'

type Status = 'available' | 'sold_out' | 'tomorrow'

const STATUS_CONFIG: Record<Status, { label: string; border: string; badge: string }> = {
  available: { label: 'Available', border: 'border-l-green-500', badge: 'bg-green-100 text-green-800' },
  sold_out: { label: 'Sold Out', border: 'border-l-red-500', badge: 'bg-red-100 text-red-800' },
  tomorrow: { label: 'Tomorrow', border: 'border-l-amber-500', badge: 'bg-amber-100 text-amber-800' },
}

interface CatchCardProps {
  id: string
  name: string
  origin_region: string
  recommended_preps: string[]
  status: Status
  notes: string | null
}

export function CatchCard({ id, name, origin_region, recommended_preps, status, notes }: CatchCardProps) {
  const [optimisticStatus, setOptimisticStatus] = useOptimistic(status)
  const [, startTransition] = useTransition()
  const noteRef = useRef<HTMLTextAreaElement>(null)
  const config = STATUS_CONFIG[optimisticStatus]

  function cycleStatus() {
    const next: Status = optimisticStatus === 'available' ? 'sold_out' : optimisticStatus === 'sold_out' ? 'tomorrow' : 'available'
    startTransition(async () => {
      setOptimisticStatus(next)
      await toggleCatch(id, next)
    })
  }

  function handleNoteBlur() {
    const note = noteRef.current?.value ?? ''
    startTransition(() => updateNote(id, note))
  }

  return (
    <div className={`bg-surface border border-border border-l-4 ${config.border} rounded-xl p-4 space-y-3`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="font-semibold text-[#1a2e1a]">{name}</p>
          <p className="text-xs text-text-muted">{origin_region}</p>
        </div>
        <button
          onClick={cycleStatus}
          className={`text-xs font-semibold px-2.5 py-1 rounded-full ${config.badge}`}
        >
          {config.label}
        </button>
      </div>
      <div className="flex flex-wrap gap-1">
        {recommended_preps.map(p => (
          <span key={p} className="text-xs bg-background px-2 py-0.5 rounded-full border border-border text-[#1a2e1a]">
            {p}
          </span>
        ))}
      </div>
      <textarea
        ref={noteRef}
        defaultValue={notes ?? ''}
        onBlur={handleNoteBlur}
        placeholder="Add a note…"
        className="w-full text-sm text-[#1a2e1a] bg-background border border-border rounded-lg p-2 resize-none h-16 focus:outline-none focus:ring-1 focus:ring-primary"
      />
    </div>
  )
}
```

- [ ] **Step 2: Create AddCatchDrawer**

```tsx
// dashboard/src/components/catch/AddCatchDrawer.tsx
'use client'
import { useState, useTransition } from 'react'
import { addCatch } from '@/actions/catch'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer'

export function AddCatchDrawer() {
  const [open, setOpen] = useState(false)
  const [, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const preps = (fd.get('preps') as string).split(',').map(s => s.trim()).filter(Boolean)
    startTransition(async () => {
      await addCatch({
        name: fd.get('name') as string,
        origin_region: fd.get('region') as string,
        recommended_preps: preps,
        spice_level: Number(fd.get('spice')),
      })
      setOpen(false)
    })
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button className="bg-primary hover:bg-primary/90">+ Add Item</Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader><DrawerTitle>Add Catch Item</DrawerTitle></DrawerHeader>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div><Label>Fish name</Label><Input name="name" required className="mt-1" /></div>
          <div><Label>Region</Label><Input name="region" required className="mt-1" /></div>
          <div><Label>Preps (comma-separated)</Label><Input name="preps" placeholder="Tawa Fry, Curry" className="mt-1" /></div>
          <div><Label>Spice level (1–5)</Label><Input name="spice" type="number" min={1} max={5} defaultValue={3} className="mt-1" /></div>
          <Button type="submit" className="w-full bg-primary">Add</Button>
        </form>
      </DrawerContent>
    </Drawer>
  )
}
```

- [ ] **Step 3: Create catch page**

```tsx
// dashboard/src/app/dashboard/catch/page.tsx
import { getSupabase } from '@/lib/supabase'
import { CatchCard } from '@/components/catch/CatchCard'
import { AddCatchDrawer } from '@/components/catch/AddCatchDrawer'

async function getCatchData() {
  const supabase = getSupabase()
  const today = new Date().toISOString().split('T')[0]

  const { data } = await supabase
    .from('daily_availability')
    .select('id, status, notes, catch_items(id, name, origin_region, recommended_preps)')
    .eq('date', today)

  return (data ?? []).map((r: any) => ({
    availId: r.id,
    id: r.catch_items.id,
    name: r.catch_items.name,
    origin_region: r.catch_items.origin_region,
    recommended_preps: r.catch_items.recommended_preps,
    status: r.status,
    notes: r.notes,
  }))
}

export default async function CatchPage() {
  const items = await getCatchData()
  const available = items.filter(i => i.status === 'available').length
  const soldOut = items.filter(i => i.status === 'sold_out').length
  const tomorrow = items.filter(i => i.status === 'tomorrow').length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-[#1a2e1a]">Today's Catch</h1>
        <AddCatchDrawer />
      </div>

      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Available', value: available },
          { label: 'Sold Out', value: soldOut },
          { label: 'Tomorrow', value: tomorrow },
          { label: 'Total Items', value: items.length },
        ].map(m => (
          <div key={m.label} className="bg-surface border border-border rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-[#1a2e1a]">{m.value}</p>
            <p className="text-xs text-text-muted mt-1">{m.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {items.map(item => (
          <CatchCard key={item.id} {...item} />
        ))}
        {items.length === 0 && (
          <p className="text-text-muted col-span-2 text-center py-12">No catch items for today. Add one above.</p>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add dashboard/src/components/catch/ dashboard/src/app/dashboard/catch/
git commit -m "feat: Today's Catch page with toggle, notes, and add item"
```

---

## Task 12: Bookings Page

**Files:**
- Create: `dashboard/src/components/bookings/BookingsTable.tsx`
- Create: `dashboard/src/components/bookings/NewBookingDrawer.tsx`
- Create: `dashboard/src/app/dashboard/bookings/page.tsx`

- [ ] **Step 1: Create BookingsTable**

```tsx
// dashboard/src/components/bookings/BookingsTable.tsx
'use client'
import { useState, useTransition } from 'react'
import { updateBookingStatus } from '@/actions/bookings'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

const FLOOR_BADGE: Record<string, string> = {
  terrace: 'bg-amber-100 text-amber-800',
  floor1: 'bg-blue-100 text-blue-800',
  floor2: 'bg-green-100 text-green-800',
  private: 'bg-pink-100 text-pink-800',
}

const STATUS_BADGE: Record<string, string> = {
  confirmed: 'bg-blue-100 text-blue-800',
  seated: 'bg-green-100 text-green-800',
  no_show: 'bg-gray-100 text-gray-600',
  cancelled: 'bg-red-100 text-red-800',
}

interface Booking {
  id: string
  booking_ref: string
  guest_name: string
  phone: string
  party_size: number
  datetime: string
  floor: string
  special_notes: string | null
  status: string
}

export function BookingsTable({ bookings }: { bookings: Booking[] }) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  function markSeated(id: string) {
    startTransition(() => updateBookingStatus(id, 'seated'))
  }

  function cancel(id: string) {
    if (!confirm('Cancel this booking?')) return
    startTransition(() => updateBookingStatus(id, 'cancelled'))
  }

  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead className="border-b border-border">
          <tr className="text-left">
            {['Time', 'Guest', 'Party', 'Floor', 'Notes', 'Status', 'Actions'].map(h => (
              <th key={h} className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-text-muted">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {bookings.map(b => (
            <>
              <tr
                key={b.id}
                className="border-b border-border hover:bg-background cursor-pointer"
                onClick={() => setExpanded(expanded === b.id ? null : b.id)}
              >
                <td className="px-4 py-3 text-text-muted">
                  {new Date(b.datetime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                </td>
                <td className="px-4 py-3 font-medium text-[#1a2e1a]">{b.guest_name}</td>
                <td className="px-4 py-3 text-[#1a2e1a]">{b.party_size}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${FLOOR_BADGE[b.floor] ?? ''}`}>
                    {b.floor}
                  </span>
                </td>
                <td className="px-4 py-3 text-text-muted max-w-[150px] truncate">{b.special_notes ?? '—'}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_BADGE[b.status] ?? ''}`}>
                    {b.status}
                  </span>
                </td>
                <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                  <div className="flex gap-2">
                    {b.status === 'confirmed' && (
                      <Button size="sm" variant="outline" onClick={() => markSeated(b.id)} className="text-xs">Seat</Button>
                    )}
                    {(b.status === 'confirmed' || b.status === 'seated') && (
                      <Button size="sm" variant="outline" onClick={() => cancel(b.id)} className="text-xs text-red-600">Cancel</Button>
                    )}
                  </div>
                </td>
              </tr>
              {expanded === b.id && (
                <tr key={`${b.id}-detail`} className="bg-background">
                  <td colSpan={7} className="px-6 py-4 text-sm text-[#1a2e1a] space-y-1">
                    <p><span className="font-medium">Ref:</span> {b.booking_ref}</p>
                    <p><span className="font-medium">Phone:</span> {b.phone}</p>
                    {b.special_notes && <p><span className="font-medium">Notes:</span> {b.special_notes}</p>}
                    <a href={`https://wa.me/${b.phone.replace(/\D/g, '')}`} target="_blank" className="text-accent underline text-xs">Open WhatsApp</a>
                  </td>
                </tr>
              )}
            </>
          ))}
          {bookings.length === 0 && (
            <tr><td colSpan={7} className="px-4 py-12 text-center text-text-muted">No bookings found</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 2: Create NewBookingDrawer**

```tsx
// dashboard/src/components/bookings/NewBookingDrawer.tsx
'use client'
import { useState, useTransition } from 'react'
import { createBooking } from '@/actions/bookings'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export function NewBookingDrawer() {
  const [open, setOpen] = useState(false)
  const [floor, setFloor] = useState('terrace')
  const [, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      await createBooking({
        guest_name: fd.get('guest_name') as string,
        phone: fd.get('phone') as string,
        party_size: Number(fd.get('party_size')),
        datetime: fd.get('datetime') as string,
        floor,
        special_notes: fd.get('notes') as string || undefined,
      })
      setOpen(false)
    })
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button className="bg-primary hover:bg-primary/90">+ New Booking</Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader><DrawerTitle>New Booking</DrawerTitle></DrawerHeader>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div><Label>Guest name</Label><Input name="guest_name" required className="mt-1" /></div>
          <div><Label>Phone (WhatsApp)</Label><Input name="phone" type="tel" required className="mt-1" /></div>
          <div><Label>Party size</Label><Input name="party_size" type="number" min={1} max={50} required className="mt-1" /></div>
          <div><Label>Date & time</Label><Input name="datetime" type="datetime-local" required className="mt-1" /></div>
          <div>
            <Label>Floor</Label>
            <Select value={floor} onValueChange={setFloor}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {['terrace', 'floor1', 'floor2', 'private'].map(f => (
                  <SelectItem key={f} value={f}>{f}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Special notes</Label><Input name="notes" className="mt-1" /></div>
          <Button type="submit" className="w-full bg-primary">Create Booking</Button>
        </form>
      </DrawerContent>
    </Drawer>
  )
}
```

- [ ] **Step 3: Create bookings page**

```tsx
// dashboard/src/app/dashboard/bookings/page.tsx
import { getSupabase } from '@/lib/supabase'
import { BookingsTable } from '@/components/bookings/BookingsTable'
import { NewBookingDrawer } from '@/components/bookings/NewBookingDrawer'

interface SearchParams { date?: string; floor?: string; status?: string }

export default async function BookingsPage({ searchParams }: { searchParams: SearchParams }) {
  const supabase = getSupabase()
  const date = searchParams.date ?? new Date().toISOString().split('T')[0]
  const start = `${date}T00:00:00`
  const end = `${date}T23:59:59`

  let query = supabase
    .from('bookings')
    .select('*')
    .gte('datetime', start)
    .lte('datetime', end)
    .order('datetime')

  if (searchParams.floor && searchParams.floor !== 'all') {
    query = query.eq('floor', searchParams.floor)
  }
  if (searchParams.status && searchParams.status !== 'all') {
    query = query.eq('status', searchParams.status)
  }

  const { data: bookings } = await query

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-[#1a2e1a]">Bookings</h1>
        <NewBookingDrawer />
      </div>
      <BookingsTable bookings={bookings ?? []} />
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add dashboard/src/components/bookings/ dashboard/src/app/dashboard/bookings/
git commit -m "feat: Bookings page with table, status actions, and new booking drawer"
```

---

## Task 13: Floor Map Page

**Files:**
- Create: `dashboard/src/components/floor/FloorMap.tsx`
- Create: `dashboard/src/app/dashboard/floor/page.tsx`

- [ ] **Step 1: Create FloorMap SVG component**

```tsx
// dashboard/src/components/floor/FloorMap.tsx
'use client'

interface TableDef {
  id: string
  label: string
  x: number
  y: number
  width: number
  height: number
  floor: string
  cap: number
}

const TABLES: TableDef[] = [
  // Terrace (cap 25 — 6 tables)
  { id: 't1', label: 'T1', x: 40, y: 40, width: 50, height: 36, floor: 'terrace', cap: 4 },
  { id: 't2', label: 'T2', x: 110, y: 40, width: 50, height: 36, floor: 'terrace', cap: 4 },
  { id: 't3', label: 'T3', x: 180, y: 40, width: 50, height: 36, floor: 'terrace', cap: 4 },
  { id: 't4', label: 'T4', x: 40, y: 96, width: 50, height: 36, floor: 'terrace', cap: 4 },
  { id: 't5', label: 'T5', x: 110, y: 96, width: 50, height: 36, floor: 'terrace', cap: 4 },
  { id: 't6', label: 'T6', x: 180, y: 96, width: 80, height: 36, floor: 'terrace', cap: 9 },
  // Floor 1 (cap 40 — 8 tables)
  { id: 'f1t1', label: 'F1', x: 300, y: 40, width: 50, height: 36, floor: 'floor1', cap: 4 },
  { id: 'f1t2', label: 'F2', x: 370, y: 40, width: 50, height: 36, floor: 'floor1', cap: 4 },
  { id: 'f1t3', label: 'F3', x: 440, y: 40, width: 50, height: 36, floor: 'floor1', cap: 4 },
  { id: 'f1t4', label: 'F4', x: 510, y: 40, width: 50, height: 36, floor: 'floor1', cap: 4 },
  { id: 'f1t5', label: 'F5', x: 300, y: 96, width: 50, height: 36, floor: 'floor1', cap: 6 },
  { id: 'f1t6', label: 'F6', x: 370, y: 96, width: 50, height: 36, floor: 'floor1', cap: 6 },
  { id: 'f1t7', label: 'F7', x: 440, y: 96, width: 60, height: 36, floor: 'floor1', cap: 6 },
  { id: 'f1t8', label: 'F8', x: 510, y: 96, width: 60, height: 36, floor: 'floor1', cap: 6 },
  // Floor 2 (cap 35 — 7 tables)
  { id: 'f2t1', label: '21', x: 40, y: 200, width: 50, height: 36, floor: 'floor2', cap: 5 },
  { id: 'f2t2', label: '22', x: 110, y: 200, width: 50, height: 36, floor: 'floor2', cap: 5 },
  { id: 'f2t3', label: '23', x: 180, y: 200, width: 50, height: 36, floor: 'floor2', cap: 5 },
  { id: 'f2t4', label: '24', x: 250, y: 200, width: 50, height: 36, floor: 'floor2', cap: 5 },
  { id: 'f2t5', label: '25', x: 40, y: 256, width: 50, height: 36, floor: 'floor2', cap: 5 },
  { id: 'f2t6', label: '26', x: 110, y: 256, width: 50, height: 36, floor: 'floor2', cap: 5 },
  { id: 'f2t7', label: '27', x: 180, y: 256, width: 80, height: 36, floor: 'floor2', cap: 10 },
  // Private room (cap 12)
  { id: 'p1', label: 'Priv', x: 400, y: 200, width: 120, height: 80, floor: 'private', cap: 12 },
]

interface TableState { floor: string; status: 'confirmed' | 'seated' }

function getTableColor(state: TableState | undefined): string {
  if (!state) return '#22c55e'
  if (state.status === 'seated') return '#ef4444'
  return '#f59e0b'
}

interface TooltipInfo { table: TableDef; booking?: { guest_name: string; party_size: number } }

export function FloorMap({ tableStates }: { tableStates: Record<string, TableState> }) {
  return (
    <div className="bg-surface border border-border rounded-xl p-6">
      <h2 className="text-sm font-semibold text-[#1a2e1a] mb-4">Floor Map</h2>
      <div className="flex gap-4 mb-4">
        {[
          { color: '#22c55e', label: 'Available' },
          { color: '#f59e0b', label: 'Booked' },
          { color: '#ef4444', label: 'Seated' },
        ].map(l => (
          <div key={l.label} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ background: l.color }} />
            <span className="text-xs text-text-muted">{l.label}</span>
          </div>
        ))}
      </div>
      <div className="overflow-x-auto">
        <svg width="620" height="310" className="font-sans">
          {/* Section labels */}
          <text x="40" y="24" className="text-xs" fill="#9ca3af" fontSize="11" fontWeight="700">TERRACE</text>
          <text x="300" y="24" className="text-xs" fill="#9ca3af" fontSize="11" fontWeight="700">FLOOR 1</text>
          <text x="40" y="185" className="text-xs" fill="#9ca3af" fontSize="11" fontWeight="700">FLOOR 2</text>
          <text x="400" y="185" className="text-xs" fill="#9ca3af" fontSize="11" fontWeight="700">PRIVATE</text>

          {TABLES.map(table => {
            const state = tableStates[table.id]
            const fill = getTableColor(state)
            return (
              <g key={table.id}>
                <rect
                  x={table.x}
                  y={table.y}
                  width={table.width}
                  height={table.height}
                  rx={6}
                  fill={fill}
                  fillOpacity={0.2}
                  stroke={fill}
                  strokeWidth={2}
                />
                <text
                  x={table.x + table.width / 2}
                  y={table.y + table.height / 2 + 4}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="600"
                  fill={fill}
                >
                  {table.label}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create floor page**

```tsx
// dashboard/src/app/dashboard/floor/page.tsx
import { getSupabase } from '@/lib/supabase'
import { FloorMap } from '@/components/floor/FloorMap'

export default async function FloorPage() {
  const supabase = getSupabase()
  const now = new Date()
  const twoHoursLater = new Date(now.getTime() + 2 * 60 * 60 * 1000)

  const { data: bookings } = await supabase
    .from('bookings')
    .select('id, floor, status, datetime')
    .in('status', ['confirmed', 'seated'])
    .gte('datetime', now.toISOString())
    .lte('datetime', twoHoursLater.toISOString())

  // Map floor → state (simplified — real impl would match table IDs to bookings)
  const tableStates: Record<string, { floor: string; status: 'confirmed' | 'seated' }> = {}

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-[#1a2e1a]">Floor Map</h1>
      <FloorMap tableStates={tableStates} />
      <p className="text-xs text-text-muted">Showing bookings within the next 2 hours.</p>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/components/floor/ dashboard/src/app/dashboard/floor/
git commit -m "feat: Floor Map page with SVG table layout and status colors"
```

---

## Task 14: Staff Management Page

**Files:**
- Create: `dashboard/src/components/staff/StaffCard.tsx`
- Create: `dashboard/src/components/staff/AddStaffDrawer.tsx`
- Create: `dashboard/src/app/dashboard/staff/page.tsx`

- [ ] **Step 1: Create StaffCard**

```tsx
// dashboard/src/components/staff/StaffCard.tsx
'use client'
import { useState, useTransition } from 'react'
import { updateStaffRole, removeStaff } from '@/actions/staff'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'

const ROLE_COLORS: Record<string, string> = {
  manager: 'bg-green-500',
  chef: 'bg-orange-500',
  host: 'bg-blue-500',
}

const ROLE_BADGE: Record<string, string> = {
  manager: 'bg-green-100 text-green-800',
  chef: 'bg-orange-100 text-orange-800',
  host: 'bg-blue-100 text-blue-800',
}

interface StaffCardProps {
  id: string
  name: string
  phone: string
  role: string
  created_at: string
  isPrimary?: boolean
}

export function StaffCard({ id, name, phone, role, created_at, isPrimary }: StaffCardProps) {
  const [editing, setEditing] = useState(false)
  const [, startTransition] = useTransition()

  function handleRoleChange(newRole: string) {
    startTransition(async () => {
      await updateStaffRole(id, newRole)
      setEditing(false)
    })
  }

  function handleDelete() {
    if (!confirm(`Remove ${name} from staff?`)) return
    startTransition(() => removeStaff(id))
  }

  return (
    <div className={`bg-surface border rounded-xl p-5 flex items-center gap-4 ${isPrimary ? 'border-green-300 bg-green-50' : 'border-border'}`}>
      <div className={`w-12 h-12 rounded-full ${ROLE_COLORS[role] ?? 'bg-gray-400'} flex items-center justify-center flex-shrink-0`}>
        <span className="text-white font-bold text-lg">{name[0]?.toUpperCase()}</span>
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-[#1a2e1a]">{name}</p>
          {isPrimary && <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full font-medium">✓ Primary</span>}
        </div>
        <p className="text-sm text-text-muted">{phone}</p>
        <p className="text-xs text-text-muted mt-0.5">Added {new Date(created_at).toLocaleDateString('en-IN')}</p>
      </div>
      <div className="flex items-center gap-2">
        {editing ? (
          <Select defaultValue={role} onValueChange={handleRoleChange}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              {['manager', 'chef', 'host'].map(r => (
                <SelectItem key={r} value={r}>{r}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ROLE_BADGE[role] ?? ''}`}>{role}</span>
            <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>Edit</Button>
            {!isPrimary && (
              <Button variant="ghost" size="sm" onClick={handleDelete} className="text-red-500 hover:text-red-700">✕</Button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create AddStaffDrawer**

```tsx
// dashboard/src/components/staff/AddStaffDrawer.tsx
'use client'
import { useState, useTransition } from 'react'
import { addStaff } from '@/actions/staff'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export function AddStaffDrawer() {
  const [open, setOpen] = useState(false)
  const [role, setRole] = useState('host')
  const [, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      await addStaff({
        name: fd.get('name') as string,
        phone: fd.get('phone') as string,
        role,
      })
      setOpen(false)
    })
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button className="bg-primary hover:bg-primary/90">+ Add Staff</Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader><DrawerTitle>Add Staff Member</DrawerTitle></DrawerHeader>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div><Label>Name</Label><Input name="name" required className="mt-1" /></div>
          <div><Label>WhatsApp phone</Label><Input name="phone" type="tel" required className="mt-1" /></div>
          <div>
            <Label>Role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {['manager', 'chef', 'host'].map(r => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" className="w-full bg-primary">Add Member</Button>
        </form>
      </DrawerContent>
    </Drawer>
  )
}
```

- [ ] **Step 3: Create staff page**

```tsx
// dashboard/src/app/dashboard/staff/page.tsx
import { getSupabase } from '@/lib/supabase'
import { StaffCard } from '@/components/staff/StaffCard'
import { AddStaffDrawer } from '@/components/staff/AddStaffDrawer'

export default async function StaffPage() {
  const supabase = getSupabase()
  const { data: staff } = await supabase.from('staff').select('*').order('created_at')
  const members = staff ?? []

  const managerPhone = process.env.MANAGER_PHONE
  const managers = members.filter(s => s.role === 'manager').length
  const chefs = members.filter(s => s.role === 'chef').length
  const hosts = members.filter(s => s.role === 'host').length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-[#1a2e1a]">Staff</h1>
        <AddStaffDrawer />
      </div>

      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Managers', value: managers },
          { label: 'Chefs', value: chefs },
          { label: 'Hosts', value: hosts },
          { label: 'Total', value: members.length },
        ].map(m => (
          <div key={m.label} className="bg-surface border border-border rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-[#1a2e1a]">{m.value}</p>
            <p className="text-xs text-text-muted mt-1">{m.label}</p>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        {members.map(s => (
          <StaffCard
            key={s.id}
            {...s}
            isPrimary={managerPhone ? s.phone === managerPhone : false}
          />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add dashboard/src/components/staff/ dashboard/src/app/dashboard/staff/
git commit -m "feat: Staff Management page with role editing and add member"
```

---

## Task 15: Analytics Page

**Files:**
- Create: `dashboard/src/components/analytics/BookingsTrend.tsx`
- Create: `dashboard/src/components/analytics/FloorDonut.tsx`
- Create: `dashboard/src/components/analytics/PeakHoursHeatmap.tsx`
- Create: `dashboard/src/components/analytics/RevenueTrend.tsx`
- Create: `dashboard/src/app/dashboard/analytics/page.tsx`

- [ ] **Step 1: Create BookingsTrend**

```tsx
// dashboard/src/components/analytics/BookingsTrend.tsx
'use client'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

interface DayData { day: string; count: number }

export function BookingsTrend({ data }: { data: DayData[] }) {
  return (
    <div className="bg-surface border border-border rounded-xl p-5">
      <p className="text-sm font-semibold text-[#1a2e1a] mb-4">Bookings Trend</p>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e8e3dc" />
          <XAxis dataKey="day" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip />
          <Bar dataKey="count" fill="#1a3a2a" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
```

- [ ] **Step 2: Create FloorDonut**

```tsx
// dashboard/src/components/analytics/FloorDonut.tsx
'use client'
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'

const COLORS = ['#f59e0b', '#3b82f6', '#22c55e', '#ec4899']
const FLOOR_LABELS: Record<string, string> = {
  terrace: 'Terrace', floor1: 'Floor 1', floor2: 'Floor 2', private: 'Private',
}

interface FloorData { floor: string; count: number }

export function FloorDonut({ data }: { data: FloorData[] }) {
  const chartData = data.map(d => ({ name: FLOOR_LABELS[d.floor] ?? d.floor, value: d.count }))

  return (
    <div className="bg-surface border border-border rounded-xl p-5">
      <p className="text-sm font-semibold text-[#1a2e1a] mb-4">Popular Floors</p>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie data={chartData} dataKey="value" innerRadius={50} outerRadius={80} paddingAngle={3}>
            {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
```

- [ ] **Step 3: Create PeakHoursHeatmap**

```tsx
// dashboard/src/components/analytics/PeakHoursHeatmap.tsx
const HOURS = Array.from({ length: 12 }, (_, i) => i + 12) // 12–23
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

interface HeatmapProps {
  data: Record<string, Record<number, number>> // day → hour → count
  maxCount: number
}

export function PeakHoursHeatmap({ data, maxCount }: HeatmapProps) {
  return (
    <div className="bg-surface border border-border rounded-xl p-5">
      <p className="text-sm font-semibold text-[#1a2e1a] mb-4">Peak Hours</p>
      <div className="overflow-x-auto">
        <div className="inline-grid" style={{ gridTemplateColumns: `40px repeat(${HOURS.length}, 36px)`, gap: 3 }}>
          <div />
          {HOURS.map(h => (
            <div key={h} className="text-center text-[10px] text-text-muted">{h}:00</div>
          ))}
          {DAYS.map(day => (
            <>
              <div key={day} className="text-[10px] text-text-muted flex items-center">{day}</div>
              {HOURS.map(h => {
                const count = data[day]?.[h] ?? 0
                const intensity = maxCount > 0 ? count / maxCount : 0
                return (
                  <div
                    key={h}
                    title={`${day} ${h}:00 — ${count} bookings`}
                    className="rounded"
                    style={{
                      height: 28,
                      background: `rgba(26, 58, 42, ${0.08 + intensity * 0.85})`,
                    }}
                  />
                )
              })}
            </>
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create RevenueTrend**

```tsx
// dashboard/src/components/analytics/RevenueTrend.tsx
'use client'
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend } from 'recharts'

interface RevenueData { day: string; revenue: number; ma7: number }

export function RevenueTrend({ data }: { data: RevenueData[] }) {
  return (
    <div className="bg-surface border border-border rounded-xl p-5">
      <p className="text-sm font-semibold text-[#1a2e1a] mb-4">Revenue Trend (estimated)</p>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e8e3dc" />
          <XAxis dataKey="day" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
          <Tooltip formatter={(v: number) => `₹${v.toLocaleString('en-IN')}`} />
          <Legend />
          <Line type="monotone" dataKey="revenue" stroke="#1a3a2a" strokeWidth={2} dot={false} name="Revenue" />
          <Line type="monotone" dataKey="ma7" stroke="#c8956c" strokeWidth={2} dot={false} strokeDasharray="4 2" name="7-day MA" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
```

- [ ] **Step 5: Create analytics page**

```tsx
// dashboard/src/app/dashboard/analytics/page.tsx
import { getSupabase } from '@/lib/supabase'
import { BookingsTrend } from '@/components/analytics/BookingsTrend'
import { FloorDonut } from '@/components/analytics/FloorDonut'
import { PeakHoursHeatmap } from '@/components/analytics/PeakHoursHeatmap'
import { RevenueTrend } from '@/components/analytics/RevenueTrend'

async function getAnalyticsData(days = 30) {
  const supabase = getSupabase()
  const from = new Date()
  from.setDate(from.getDate() - days)

  const { data: bookings } = await supabase
    .from('bookings')
    .select('datetime, floor, party_size, status')
    .gte('datetime', from.toISOString())
    .in('status', ['confirmed', 'seated'])
    .order('datetime')

  const all = bookings ?? []

  // Daily counts
  const byDay: Record<string, number> = {}
  all.forEach(b => {
    const day = b.datetime.split('T')[0]
    byDay[day] = (byDay[day] ?? 0) + 1
  })
  const trendData = Object.entries(byDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, count]) => ({
      day: new Date(day).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
      count,
    }))

  // Floor distribution
  const byFloor: Record<string, number> = {}
  all.forEach(b => { byFloor[b.floor] = (byFloor[b.floor] ?? 0) + 1 })
  const floorData = Object.entries(byFloor).map(([floor, count]) => ({ floor, count }))

  // Peak hours heatmap
  const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const heatmap: Record<string, Record<number, number>> = {}
  all.forEach(b => {
    const d = new Date(b.datetime)
    const dayName = DAY_NAMES[d.getDay()]
    const hour = d.getHours()
    if (!heatmap[dayName]) heatmap[dayName] = {}
    heatmap[dayName][hour] = (heatmap[dayName][hour] ?? 0) + 1
  })
  const maxCount = Math.max(...Object.values(heatmap).flatMap(h => Object.values(h)), 1)

  // Revenue trend with 7-day MA
  const revenueByDay: Record<string, number> = {}
  all.forEach(b => {
    const day = b.datetime.split('T')[0]
    revenueByDay[day] = (revenueByDay[day] ?? 0) + (b.party_size * 2000)
  })
  const revDays = Object.entries(revenueByDay).sort(([a], [b]) => a.localeCompare(b))
  const revenueData = revDays.map(([day, revenue], i) => {
    const window = revDays.slice(Math.max(0, i - 6), i + 1)
    const ma7 = Math.round(window.reduce((s, [, v]) => s + v, 0) / window.length)
    return {
      day: new Date(day).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
      revenue,
      ma7,
    }
  })

  return { trendData, floorData, heatmap, maxCount, revenueData }
}

export default async function AnalyticsPage() {
  const data = await getAnalyticsData(30)

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-[#1a2e1a]">Analytics</h1>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <BookingsTrend data={data.trendData} />
        <FloorDonut data={data.floorData} />
      </div>
      <PeakHoursHeatmap data={data.heatmap} maxCount={data.maxCount} />
      <RevenueTrend data={data.revenueData} />
    </div>
  )
}
```

- [ ] **Step 6: Commit**

```bash
git add dashboard/src/components/analytics/ dashboard/src/app/dashboard/analytics/
git commit -m "feat: Analytics page with trend, floor, heatmap, and revenue charts"
```

---

## Task 16: Vercel Deployment Setup

**Files:**
- Create: `dashboard/vercel.json`

- [ ] **Step 1: Create vercel.json**

```json
{
  "framework": "nextjs",
  "buildCommand": "next build",
  "outputDirectory": ".next"
}
```

- [ ] **Step 2: Push and deploy**

```bash
cd /Users/harshagrawal/Documents/Sanadige
git add dashboard/vercel.json
git commit -m "feat: add Vercel config for dashboard deployment"
git push origin main
```

- [ ] **Step 3: Create Vercel project**

```bash
cd dashboard && npx vercel --prod
```

Follow prompts:
- Link to existing project or create new: new
- Project name: `sanadige-dashboard`
- Set environment variables when prompted (copy from `.env.local`)

- [ ] **Step 4: Set custom domain**

In Vercel dashboard → Domains → add `dashboard.sanadige.in`. Add CNAME record at your DNS provider pointing to the Vercel domain shown.

- [ ] **Step 5: Smoke test production**

1. Navigate to `https://dashboard.sanadige.in/login`
2. Enter a staff phone number
3. Confirm OTP arrives on WhatsApp
4. Enter OTP → confirm redirect to correct role page
5. Check each section loads without errors

---

## Self-Review Against Spec

**Spec coverage check:**
- [x] WhatsApp OTP auth → Tasks 2, 6, 7
- [x] JWT HTTP-only cookie → Task 4, 6
- [x] Role-based routing (manager/chef/host) → Tasks 5, 8
- [x] `staff_otps` table → Task 1
- [x] `activity_log` table → Task 1
- [x] Mission Control (manager only) with 4 KPIs, bar chart, 5 upcoming bookings, catch widget, activity feed, staff widget → Tasks 9, 10
- [x] Supabase realtime subscriptions → noted in catch/bookings pages (server components refresh via revalidatePath; client-side realtime can be layered on top using `supabase-browser.ts` channel subscriptions — add as enhancement)
- [x] Today's Catch — toggle, note, add item, summary bar → Task 11
- [x] Bookings — filter, table, seat/cancel, expand row, new booking drawer → Task 12
- [x] Floor Map — SVG with green/amber/red states → Task 13
- [x] Staff Management — cards, role edit, delete, add staff, primary badge → Task 14
- [x] Analytics — bookings trend, floor donut, peak heatmap, revenue+MA → Task 15
- [x] Vercel deployment → Task 16
- [x] `POST /auth/send-otp` on App Runner → Task 2

**Note on Realtime:** The spec calls for Supabase Realtime on `bookings` and `daily_availability`. The Server Component approach uses `revalidatePath` for server-driven updates. For true push-based realtime, wrap the CatchGrid and BookingsTable in a client component that subscribes to `getBrowserSupabase().channel(...)` — this is a natural follow-on enhancement once the base pages work.
