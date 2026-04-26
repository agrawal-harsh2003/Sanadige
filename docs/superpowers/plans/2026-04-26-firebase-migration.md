# Firebase Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all Supabase usage with Google Firebase (Firestore + Firebase Auth), implement phone-number OTP login for the dashboard, and store all application data in Firestore collections.

**Architecture:** Firebase Admin SDK runs server-side in both backend (Express) and dashboard (Next.js server components/actions). Firebase Client SDK runs only in the browser for `onSnapshot` realtime and the phone-number OTP sign-in flow. Session management uses httpOnly Firebase session cookies verified server-side via `adminAuth.verifySessionCookie()`.

**Tech Stack:** Firebase Admin SDK v12, Firebase Client SDK v10, Firestore, Firebase Auth (phone/SMS OTP), node-cron (unchanged), Next.js App Router, Express

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `backend/src/lib/firebase.ts` | Create | Admin SDK init, exports `db`, `adminAuth` |
| `backend/src/env.ts` | Modify | Add Firebase env vars |
| `backend/src/services/staff.ts` | Rewrite | Firestore staff CRUD |
| `backend/src/services/staff-menu.ts` | Modify | Firebase Auth custom claims on add/remove |
| `backend/src/services/claude.ts` | Modify | Firestore conversation history |
| `backend/src/tools/create-booking.ts` | Modify | Firestore booking insert |
| `backend/src/tools/check-floor-availability.ts` | Modify | Firestore availability query |
| `backend/src/services/guests.ts` | Rewrite | Firestore guest CRM |
| `backend/src/services/reminder.ts` | Rewrite | Firestore queries for all cron jobs |
| `backend/src/routes/auth.ts` | Delete | Replaced by Firebase Auth |
| `backend/src/lib/supabase.ts` | Delete | Replaced by firebase.ts |
| `backend/src/index.ts` | Modify | Remove auth router, Supabase refs |
| `dashboard/src/lib/firebase-admin.ts` | Create | Admin SDK singleton for dashboard |
| `dashboard/src/lib/firebase-client.ts` | Create | Client SDK singleton |
| `dashboard/src/lib/auth.ts` | Rewrite | Session cookie verification |
| `dashboard/src/actions/auth.ts` | Rewrite | Sign-out server action |
| `dashboard/src/app/api/auth/session/route.ts` | Create | POST=create cookie, DELETE=clear cookie |
| `dashboard/src/app/login/page.tsx` | Rewrite | Phone number OTP flow |
| `dashboard/src/actions/bookings.ts` | Rewrite | Firestore booking writes |
| `dashboard/src/actions/guests.ts` | Rewrite | Firestore guest writes |
| `dashboard/src/app/dashboard/bookings/page.tsx` | Modify | Firestore read |
| `dashboard/src/app/dashboard/guests/page.tsx` | Modify | Firestore read |
| `dashboard/src/app/dashboard/guests/[id]/page.tsx` | Modify | Firestore read |
| `dashboard/src/app/dashboard/page.tsx` | Modify | Firestore read |
| `dashboard/src/components/bookings/BookingsTable.tsx` | Modify | `onSnapshot` realtime |
| `firestore.rules` | Create | Security rules |
| `firestore.indexes.json` | Create | Composite indexes |

---

## Task 1: Firebase Project Setup (Manual Steps)

**Files:** None — manual Firebase console + CLI steps

- [ ] **Step 1: Create Firebase project**

  Go to https://console.firebase.google.com → "Add project" → name it `sanadige-prod` → disable Google Analytics → Create.

- [ ] **Step 2: Enable Firestore**

  In Firebase console → Build → Firestore Database → Create database → Start in **production mode** → choose region `asia-south1` (Mumbai) → Enable.

- [ ] **Step 3: Enable Phone Authentication**

  In Firebase console → Build → Authentication → Get started → Sign-in method → Phone → Enable → Save.

- [ ] **Step 4: Download service account key**

  Firebase console → Project Settings (gear icon) → Service accounts → "Generate new private key" → Download JSON.

  Save it as `sanadige-firebase-service-account.json` in a secure location (NOT in the repo).

- [ ] **Step 5: Get Web App config**

  Firebase console → Project Settings → General → "Your apps" → Add app → Web → Register app named `sanadige-dashboard` → Copy the `firebaseConfig` object.

- [ ] **Step 6: Install Firebase CLI**

  ```bash
  npm install -g firebase-tools
  firebase login
  firebase init firestore --project sanadige-prod
  ```

  When prompted: "Use existing `firestore.rules`?" → No, create new. "Use existing `firestore.indexes.json`?" → No, create new.

- [ ] **Step 7: Set backend environment variables**

  Add to `backend/.env`:
  ```
  FIREBASE_PROJECT_ID=sanadige-prod
  FIREBASE_CLIENT_EMAIL=<from service account JSON field "client_email">
  FIREBASE_PRIVATE_KEY="<from service account JSON field "private_key" — keep quotes and \n chars>"
  ```

- [ ] **Step 8: Set dashboard environment variables**

  Add to `dashboard/.env.local`:
  ```
  # Admin (server-side)
  FIREBASE_PROJECT_ID=sanadige-prod
  FIREBASE_CLIENT_EMAIL=<from service account JSON>
  FIREBASE_PRIVATE_KEY="<from service account JSON>"

  # Client (browser-side — must be prefixed NEXT_PUBLIC_)
  NEXT_PUBLIC_FIREBASE_API_KEY=<from firebaseConfig>
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=sanadige-prod.firebaseapp.com
  NEXT_PUBLIC_FIREBASE_PROJECT_ID=sanadige-prod
  NEXT_PUBLIC_FIREBASE_APP_ID=<from firebaseConfig>
  ```

---

## Task 2: Install Packages

**Files:** `backend/package.json`, `dashboard/package.json`

- [ ] **Step 1: Install in backend**

  ```bash
  cd /Users/harshagrawal/Documents/Sanadige/backend
  npm install firebase-admin
  npm uninstall @supabase/supabase-js
  ```

- [ ] **Step 2: Install in dashboard**

  ```bash
  cd /Users/harshagrawal/Documents/Sanadige/dashboard
  npm install firebase firebase-admin
  npm uninstall @supabase/supabase-js @supabase/ssr
  ```

- [ ] **Step 3: Verify no Supabase deps remain**

  ```bash
  grep -r "supabase" /Users/harshagrawal/Documents/Sanadige/backend/package.json /Users/harshagrawal/Documents/Sanadige/dashboard/package.json
  ```

  Expected: no output.

- [ ] **Step 4: Commit**

  ```bash
  cd /Users/harshagrawal/Documents/Sanadige
  git add backend/package.json backend/package-lock.json dashboard/package.json dashboard/package-lock.json
  git commit -m "chore: swap supabase for firebase in both packages"
  ```

---

## Task 3: Backend Firebase Init + Env

**Files:**
- Create: `backend/src/lib/firebase.ts`
- Modify: `backend/src/env.ts`

- [ ] **Step 1: Add env vars to `backend/src/env.ts`**

  Open `backend/src/env.ts` and add three new fields inside the `env` object:

  ```typescript
  FIREBASE_PROJECT_ID: z.string().min(1),
  FIREBASE_CLIENT_EMAIL: z.string().email(),
  FIREBASE_PRIVATE_KEY: z.string().min(1),
  ```

- [ ] **Step 2: Create `backend/src/lib/firebase.ts`**

  ```typescript
  import { initializeApp, getApps, cert } from 'firebase-admin/app'
  import { getFirestore } from 'firebase-admin/firestore'
  import { getAuth } from 'firebase-admin/auth'
  import { env } from '../env'

  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId: env.FIREBASE_PROJECT_ID,
        clientEmail: env.FIREBASE_CLIENT_EMAIL,
        privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
    })
  }

  export const db = getFirestore()
  export const adminAuth = getAuth()
  ```

- [ ] **Step 3: Verify TypeScript compiles**

  ```bash
  cd /Users/harshagrawal/Documents/Sanadige/backend
  npx tsc --noEmit
  ```

  Expected: no errors.

- [ ] **Step 4: Commit**

  ```bash
  git add backend/src/lib/firebase.ts backend/src/env.ts
  git commit -m "feat(backend): init firebase admin sdk"
  ```

---

## Task 4: Migrate Backend Staff Service

**Files:**
- Rewrite: `backend/src/services/staff.ts`

- [ ] **Step 1: Rewrite `backend/src/services/staff.ts`**

  ```typescript
  import { db, adminAuth } from '../lib/firebase'

  export interface StaffMember {
    id: string
    phone: string
    name: string
    role: 'manager' | 'host' | 'waiter' | 'chef'
    uid?: string
  }

  export async function listStaff(): Promise<StaffMember[]> {
    const snap = await db.collection('staff').orderBy('name').get()
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as StaffMember))
  }

  export async function getStaffByPhone(phone: string): Promise<StaffMember | null> {
    const snap = await db.collection('staff').where('phone', '==', phone).limit(1).get()
    if (snap.empty) return null
    return { id: snap.docs[0].id, ...snap.docs[0].data() } as StaffMember
  }

  export async function addStaff(params: {
    phone: string
    name: string
    role: StaffMember['role']
  }): Promise<StaffMember> {
    const e164 = params.phone.startsWith('+') ? params.phone : `+91${params.phone}`
    let uid: string | undefined

    try {
      const user = await adminAuth.createUser({ phoneNumber: e164, displayName: params.name })
      uid = user.uid
      await adminAuth.setCustomUserClaims(uid, { role: params.role, name: params.name })
    } catch (err: unknown) {
      if ((err as { code?: string }).code === 'auth/phone-number-already-exists') {
        const existing = await adminAuth.getUserByPhoneNumber(e164)
        uid = existing.uid
        await adminAuth.setCustomUserClaims(uid, { role: params.role, name: params.name })
      }
    }

    const ref = await db.collection('staff').add({ ...params, phone: e164, uid })
    return { id: ref.id, ...params, phone: e164, uid }
  }

  export async function removeStaff(phone: string): Promise<void> {
    const snap = await db.collection('staff').where('phone', '==', phone).get()
    for (const doc of snap.docs) {
      const data = doc.data()
      if (data.uid) {
        try {
          await adminAuth.setCustomUserClaims(data.uid, null)
        } catch {}
      }
      await doc.ref.delete()
    }
  }

  export async function seedManagerFromEnv(): Promise<void> {
    const phone = process.env.MANAGER_PHONE
    const name = process.env.MANAGER_NAME ?? 'Manager'
    if (!phone) return
    const existing = await getStaffByPhone(phone)
    if (existing) return
    await addStaff({ phone, name, role: 'manager' })
    console.log('[staff] Seeded manager:', phone)
  }
  ```

- [ ] **Step 2: Verify TypeScript**

  ```bash
  cd /Users/harshagrawal/Documents/Sanadige/backend && npx tsc --noEmit
  ```

  Expected: no errors.

- [ ] **Step 3: Commit**

  ```bash
  git add backend/src/services/staff.ts
  git commit -m "feat(backend): migrate staff service to firestore"
  ```

---

## Task 5: Update Staff Menu for Firebase Auth Claims

**Files:**
- Modify: `backend/src/services/staff-menu.ts`

The staff menu calls `addStaff()` and `removeStaff()` — Task 4 rewrote those functions. The only changes needed are removing any Supabase-specific imports.

- [ ] **Step 1: Remove Supabase import from staff-menu.ts**

  Open `backend/src/services/staff-menu.ts`. Replace any line like:
  ```typescript
  import { supabase } from '../lib/supabase'
  ```
  with nothing (delete the line). The `addStaff`/`removeStaff` imports from `./staff` are sufficient.

- [ ] **Step 2: Verify TypeScript**

  ```bash
  cd /Users/harshagrayal/Documents/Sanadige/backend && npx tsc --noEmit
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add backend/src/services/staff-menu.ts
  git commit -m "chore(backend): remove supabase import from staff-menu"
  ```

---

## Task 6: Migrate Conversation History (claude.ts)

**Files:**
- Modify: `backend/src/services/claude.ts`

Conversations are stored as Firestore documents: `conversations/{phone}` with a `messages` array field.

- [ ] **Step 1: Rewrite `getHistory` and `saveHistory` in `backend/src/services/claude.ts`**

  Find the existing `getHistory`/`saveHistory` functions (or wherever conversation state is persisted) and replace with:

  ```typescript
  import { db } from '../lib/firebase'

  type Message = { role: 'user' | 'assistant'; content: string }

  async function getHistory(phone: string): Promise<Message[]> {
    const doc = await db.collection('conversations').doc(phone).get()
    if (!doc.exists) return []
    return (doc.data()?.messages ?? []) as Message[]
  }

  async function saveHistory(phone: string, messages: Message[]): Promise<void> {
    const trimmed = messages.slice(-20) // keep last 20 messages
    await db.collection('conversations').doc(phone).set({ messages: trimmed, updatedAt: new Date().toISOString() })
  }
  ```

- [ ] **Step 2: Remove supabase import from claude.ts**

  Delete any `import { supabase } from '../lib/supabase'` line.

- [ ] **Step 3: Verify TypeScript**

  ```bash
  cd /Users/harshagrawal/Documents/Sanadige/backend && npx tsc --noEmit
  ```

- [ ] **Step 4: Commit**

  ```bash
  git add backend/src/services/claude.ts
  git commit -m "feat(backend): migrate conversation history to firestore"
  ```

---

## Task 7: Migrate Booking Tools to Firestore

**Files:**
- Modify: `backend/src/tools/create-booking.ts`
- Modify: `backend/src/tools/check-floor-availability.ts`

- [ ] **Step 1: Rewrite `backend/src/tools/create-booking.ts`**

  ```typescript
  import { db } from '../lib/firebase'
  import { upsertGuest } from '../services/guests'
  import { notifyStaffOfBooking } from '../services/reminder'

  function generateRef(): string {
    return 'SND-' + Math.random().toString(36).substring(2, 8).toUpperCase()
  }

  function normaliseIST(dt: string): string {
    if (/[+-]\d{2}:\d{2}$/.test(dt) || dt.endsWith('Z')) return dt
    return dt + '+05:30'
  }

  export const createBookingDefinition = {
    name: 'create_booking',
    description: 'Create a restaurant reservation. Call check_floor_availability first.',
    input_schema: {
      type: 'object' as const,
      properties: {
        guest_name: { type: 'string', description: 'Full name of the guest' },
        phone: { type: 'string', description: 'Guest WhatsApp number' },
        party_size: { type: 'string', description: 'Number of guests as a string' },
        datetime: { type: 'string', description: 'ISO 8601 datetime, e.g. 2024-12-25T19:30:00' },
        floor: { type: 'string', enum: ['terrace', 'floor1', 'floor2', 'private'], description: 'Floor preference' },
        special_notes: { type: 'string', description: 'Optional dietary or seating notes' },
        occasion: { type: 'string', description: 'Optional: birthday, anniversary, business, etc.' },
      },
      required: ['guest_name', 'phone', 'party_size', 'datetime', 'floor'],
    },
  }

  export async function createBooking(input: {
    guest_name: string
    phone: string
    party_size: string
    datetime: string
    floor: string
    special_notes?: string
    occasion?: string
  }): Promise<string> {
    const booking_ref = generateRef()
    const datetimeISO = normaliseIST(input.datetime)
    const partySize = Number(input.party_size)
    const whatsappId = input.phone

    const guestId = await upsertGuest({
      phone: input.phone,
      name: input.guest_name,
      whatsappId,
      occasion: input.occasion,
    })

    await db.collection('bookings').add({
      booking_ref,
      guest_id: guestId,
      guest_name: input.guest_name,
      phone: input.phone,
      whatsapp_id: whatsappId,
      party_size: partySize,
      datetime: datetimeISO,
      floor: input.floor,
      special_notes: input.special_notes ?? null,
      occasion: input.occasion ?? null,
      status: 'confirmed',
      channel: 'whatsapp',
      reminder_sent_at: null,
      dayof_sent_at: null,
      feedback_sent_at: null,
      checked_in_at: null,
      completed_at: null,
      no_show_at: null,
      created_at: new Date().toISOString(),
    })

    // Date/time parts for staff alert
    const dt = new Date(datetimeISO)
    const istDt = new Date(dt.getTime() + 5.5 * 60 * 60 * 1000)
    const date = istDt.toISOString().split('T')[0]
    const h = istDt.getUTCHours(), m = istDt.getUTCMinutes()
    const time = `${(h % 12 || 12)}:${m.toString().padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`

    notifyStaffOfBooking({
      guestName: input.guest_name,
      partySize,
      date,
      time,
      floor: input.floor,
      ref: booking_ref,
      createdBy: 'WhatsApp Bot',
    }).catch(() => {})

    return `BOOKING_SUCCESS|ref:${booking_ref}|name:${input.guest_name}|guests:${partySize}|floor:${input.floor}|date:${date}|time:${time}`
  }
  ```

- [ ] **Step 2: Rewrite `backend/src/tools/check-floor-availability.ts`**

  ```typescript
  import { db } from '../lib/firebase'

  export const checkFloorAvailabilityDefinition = {
    name: 'check_floor_availability',
    description: 'Check if a floor has capacity for a given datetime window.',
    input_schema: {
      type: 'object' as const,
      properties: {
        floor: { type: 'string', enum: ['terrace', 'floor1', 'floor2', 'private'] },
        datetime: { type: 'string', description: 'ISO 8601 datetime to check' },
      },
      required: ['floor', 'datetime'],
    },
  }

  function normaliseIST(dt: string): string {
    if (/[+-]\d{2}:\d{2}$/.test(dt) || dt.endsWith('Z')) return dt
    return dt + '+05:30'
  }

  export async function checkFloorAvailability(input: {
    floor: string
    datetime: string
  }): Promise<string> {
    const datetimeISO = normaliseIST(input.datetime)
    const dt = new Date(datetimeISO)
    const windowStart = new Date(dt.getTime() - 90 * 60 * 1000).toISOString()
    const windowEnd = new Date(dt.getTime() + 90 * 60 * 1000).toISOString()

    const snap = await db.collection('bookings')
      .where('floor', '==', input.floor)
      .where('status', 'in', ['confirmed', 'checked_in', 'seated'])
      .where('datetime', '>=', windowStart)
      .where('datetime', '<', windowEnd)
      .get()

    const floorCaps: Record<string, number> = {
      terrace: 40,
      floor1: 60,
      floor2: 50,
      private: 20,
    }
    const cap = floorCaps[input.floor] ?? 40
    const booked = snap.docs.reduce((sum, d) => sum + (d.data().party_size ?? 0), 0)
    const available = cap - booked

    if (available <= 0) {
      return `Floor ${input.floor} is fully booked around that time. Suggest an alternative floor or time.`
    }
    return `Floor ${input.floor} has approximately ${available} covers available around ${datetimeISO}. Proceed to create the booking.`
  }
  ```

- [ ] **Step 3: Verify TypeScript**

  ```bash
  cd /Users/harshagrawal/Documents/Sanadige/backend && npx tsc --noEmit
  ```

- [ ] **Step 4: Commit**

  ```bash
  git add backend/src/tools/create-booking.ts backend/src/tools/check-floor-availability.ts
  git commit -m "feat(backend): migrate booking tools to firestore"
  ```

---

## Task 8: Migrate Guest Service to Firestore

**Files:**
- Rewrite: `backend/src/services/guests.ts`

- [ ] **Step 1: Rewrite `backend/src/services/guests.ts`**

  ```typescript
  import { db } from '../lib/firebase'
  import { FieldValue } from 'firebase-admin/firestore'

  export interface Guest {
    id: string
    phone: string
    name: string
    whatsapp_id?: string
    email?: string
    dietary_notes?: string
    seating_preference?: string
    tier: 'standard' | 'preferred' | 'vip'
    visit_count: number
    last_visit_at?: string
    first_visit_at?: string
    is_marketing_opted_in: boolean
    created_at: string
  }

  export async function upsertGuest(params: {
    phone: string
    name: string
    whatsappId?: string
    email?: string
    occasion?: string
  }): Promise<string> {
    const snap = await db.collection('guests').where('phone', '==', params.phone).limit(1).get()

    if (!snap.empty) {
      const doc = snap.docs[0]
      await doc.ref.update({
        name: params.name,
        ...(params.whatsappId ? { whatsapp_id: params.whatsappId } : {}),
        ...(params.email ? { email: params.email } : {}),
      })
      return doc.id
    }

    const now = new Date().toISOString()
    const ref = await db.collection('guests').add({
      phone: params.phone,
      name: params.name,
      whatsapp_id: params.whatsappId ?? params.phone,
      email: params.email ?? null,
      dietary_notes: null,
      seating_preference: null,
      tier: 'standard',
      visit_count: 0,
      last_visit_at: null,
      first_visit_at: now,
      is_marketing_opted_in: true,
      created_at: now,
    })
    return ref.id
  }

  export async function incrementVisitCount(guestId: string): Promise<void> {
    const now = new Date().toISOString()
    await db.collection('guests').doc(guestId).update({
      visit_count: FieldValue.increment(1),
      last_visit_at: now,
    })
  }

  export async function getGuestByPhone(phone: string): Promise<Guest | null> {
    const snap = await db.collection('guests').where('phone', '==', phone).limit(1).get()
    if (snap.empty) return null
    return { id: snap.docs[0].id, ...snap.docs[0].data() } as Guest
  }

  export async function addGuestNote(params: {
    guestId: string
    note: string
    addedBy: string
  }): Promise<void> {
    await db.collection('guests').doc(params.guestId)
      .collection('notes').add({
        note: params.note,
        added_by: params.addedBy,
        created_at: new Date().toISOString(),
      })
  }
  ```

- [ ] **Step 2: Verify TypeScript**

  ```bash
  cd /Users/harshagrawal/Documents/Sanadige/backend && npx tsc --noEmit
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add backend/src/services/guests.ts
  git commit -m "feat(backend): migrate guest service to firestore"
  ```

---

## Task 9: Migrate Reminder Service to Firestore

**Files:**
- Rewrite: `backend/src/services/reminder.ts`

- [ ] **Step 1: Rewrite `backend/src/services/reminder.ts`**

  ```typescript
  import cron from 'node-cron'
  import { db } from '../lib/firebase'
  import { sendWhatsAppMessage, sendButtons } from '../lib/whatsapp'

  const floorLabel: Record<string, string> = {
    terrace: 'Terrace',
    floor1: 'Floor 1',
    floor2: 'Floor 2',
    private: 'Private Dining Room',
  }

  function fmtTimeIST(isoString: string): string {
    const d = new Date(isoString)
    const ist = new Date(d.getTime() + 5.5 * 60 * 60 * 1000)
    const h = ist.getUTCHours()
    const m = ist.getUTCMinutes()
    const ampm = h >= 12 ? 'PM' : 'AM'
    return `${(h % 12 || 12)}:${m.toString().padStart(2, '0')} ${ampm}`
  }

  async function getStaffPhones(roles: string[]): Promise<string[]> {
    const snap = await db.collection('staff').where('role', 'in', roles).get()
    return snap.docs.map(d => d.data().phone as string).filter(Boolean)
  }

  // ── 2-Hour Booking Reminder ────────────────────────────────────────────────────

  async function sendBookingReminders(): Promise<void> {
    const now = new Date()
    const windowStart = new Date(now.getTime() + 110 * 60 * 1000).toISOString()
    const windowEnd   = new Date(now.getTime() + 120 * 60 * 1000).toISOString()

    const snap = await db.collection('bookings')
      .where('status', '==', 'confirmed')
      .where('reminder_sent_at', '==', null)
      .where('datetime', '>=', windowStart)
      .where('datetime', '<', windowEnd)
      .get()

    for (const doc of snap.docs) {
      const b = doc.data()
      const localTime = fmtTimeIST(b.datetime)
      const message = [
        `🌊 Your table at *Sanadige* is in 2 hours!`,
        ``,
        `📅 *Tonight · ${localTime}*`,
        `👥 ${b.party_size} guests · ${floorLabel[b.floor] ?? b.floor}`,
        `🔖 Ref: ${b.booking_ref}`,
        ``,
        `Need to change or cancel? Reply *cancel* or call us at +91 91678 85275.`,
        `We look forward to seeing you! 🙏`,
      ].join('\n')

      try {
        await sendWhatsAppMessage(b.whatsapp_id, message)
        await doc.ref.update({ reminder_sent_at: new Date().toISOString() })
        console.log(`[reminder] Reminder sent for ${b.booking_ref}`)
      } catch (err) {
        console.error(`[reminder] Failed reminder for ${b.booking_ref}:`, err)
      }
    }
  }

  // ── Post-Meal Feedback ─────────────────────────────────────────────────────────

  async function sendPostMealFeedback(): Promise<void> {
    const now = new Date()
    const windowStart = new Date(now.getTime() - 150 * 60 * 1000).toISOString()
    const windowEnd   = new Date(now.getTime() - 90 * 60 * 1000).toISOString()

    const snap = await db.collection('bookings')
      .where('status', 'in', ['confirmed', 'seated'])
      .where('feedback_sent_at', '==', null)
      .where('datetime', '>=', windowStart)
      .where('datetime', '<', windowEnd)
      .get()

    for (const doc of snap.docs) {
      const b = doc.data()
      const message = [
        `🙏 Thank you for dining with us tonight, *${b.guest_name}*!`,
        ``,
        `We hope your meal was everything you hoped for. 🌊`,
        ``,
        `How was your experience at Sanadige?`,
      ].join('\n')

      try {
        await sendButtons(b.whatsapp_id, message, [
          { id: 'fb_excellent', title: '⭐⭐⭐⭐⭐ Exceptional' },
          { id: 'fb_good', title: '⭐⭐⭐⭐ Very Good' },
          { id: 'fb_ok', title: '💬 Leave feedback' },
        ])
        await doc.ref.update({ feedback_sent_at: new Date().toISOString() })
        console.log(`[reminder] Feedback sent for ${b.booking_ref}`)
      } catch (err) {
        console.error(`[reminder] Failed feedback for ${b.booking_ref}:`, err)
      }
    }
  }

  // ── Evening Staff Briefing (5 PM IST = 11:30 UTC) ────────────────────────────

  async function sendEveningBriefing(): Promise<void> {
    const today = new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().split('T')[0]

    const snap = await db.collection('bookings')
      .where('status', '==', 'confirmed')
      .where('datetime', '>=', `${today}T00:00:00+05:30`)
      .where('datetime', '<=', `${today}T23:59:59+05:30`)
      .get()

    const bookings = snap.docs.map(d => d.data())
    const totalCovers = bookings.reduce((s, b) => s + (b.party_size ?? 0), 0)

    const hourCounts: Record<number, number> = {}
    bookings.forEach(b => {
      const h = new Date(b.datetime).getUTCHours() + 5
      hourCounts[h] = (hourCounts[h] ?? 0) + 1
    })
    const peakHour = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0]
    const peakStr = peakHour ? ` · Peak: ${peakHour[0]}:00 (${peakHour[1]} bookings)` : ''

    const floorBreakdown = ['terrace', 'floor1', 'floor2', 'private']
      .map(f => {
        const count = bookings.filter(b => b.floor === f).length
        return count > 0 ? `${floorLabel[f]}: ${count}` : null
      })
      .filter((l): l is string => l !== null)
      .join(' · ')

    const message = [
      `📊 *Evening Briefing — Tonight*`,
      ``,
      `📅 ${bookings.length} confirmed bookings · ${totalCovers} covers${peakStr}`,
      floorBreakdown ? `📍 ${floorBreakdown}` : null,
      ``,
      `Dashboard: dashboard.sanadige.in`,
    ].filter((l): l is string => l !== null).join('\n')

    const phones = await getStaffPhones(['manager', 'host'])
    for (const phone of phones) {
      try {
        await sendWhatsAppMessage(phone, message)
      } catch (err) {
        console.error(`[reminder] Briefing failed for ${phone}:`, err)
      }
    }
    console.log(`[reminder] Evening briefing sent to ${phones.length} staff`)
  }

  // ── Auto No-Show (20-min grace) ───────────────────────────────────────────────

  async function markNoShows(): Promise<void> {
    const cutoff = new Date(Date.now() - 20 * 60 * 1000).toISOString()

    const snap = await db.collection('bookings')
      .where('status', '==', 'confirmed')
      .where('checked_in_at', '==', null)
      .where('datetime', '<', cutoff)
      .get()

    const managerPhones = await getStaffPhones(['manager', 'host'])

    for (const doc of snap.docs) {
      const b = doc.data()
      await doc.ref.update({ status: 'no_show', no_show_at: new Date().toISOString() })
      console.log(`[reminder] No-show: ${b.booking_ref}`)

      const msg = `⚫ No-show: *${b.guest_name}* · ${fmtTimeIST(b.datetime)} · ${floorLabel[b.floor] ?? b.floor}\nRef: ${b.booking_ref}`
      for (const phone of managerPhones) {
        sendWhatsAppMessage(phone, msg).catch(() => {})
      }
    }
  }

  // ── 1-Hour Day-Of Message ─────────────────────────────────────────────────────

  async function sendDayOfMessages(): Promise<void> {
    const now = new Date()
    const windowStart = new Date(now.getTime() + 50 * 60 * 1000).toISOString()
    const windowEnd   = new Date(now.getTime() + 70 * 60 * 1000).toISOString()

    const snap = await db.collection('bookings')
      .where('status', '==', 'confirmed')
      .where('dayof_sent_at', '==', null)
      .where('datetime', '>=', windowStart)
      .where('datetime', '<', windowEnd)
      .get()

    for (const doc of snap.docs) {
      const b = doc.data()
      const time = fmtTimeIST(b.datetime)
      const message = [
        `🌊 *Sanadige* — your table is ready for tonight!`,
        ``,
        `📅 ${time} · ${floorLabel[b.floor] ?? b.floor}`,
        `📍 28, Aradhana Enclave, Chanakyapuri, New Delhi`,
        ``,
        `We look forward to welcoming you 🙏`,
      ].join('\n')

      try {
        await sendWhatsAppMessage(b.whatsapp_id, message)
        await doc.ref.update({ dayof_sent_at: new Date().toISOString() })
      } catch (err) {
        console.error(`[reminder] Day-of failed for ${b.booking_ref}:`, err)
      }
    }
  }

  // ── Staff Alert Exports ────────────────────────────────────────────────────────

  export async function notifyStaffOfBooking(params: {
    guestName: string
    partySize: number | string
    date: string
    time: string
    floor: string
    ref: string
    createdBy?: string
  }): Promise<void> {
    const phones = await getStaffPhones(['manager', 'host'])
    const message = [
      `📅 *New Booking Alert*`,
      ``,
      `👤 ${params.guestName} · ${params.partySize} guests`,
      `📅 ${params.date} · ${params.time}`,
      `📍 ${floorLabel[params.floor] ?? params.floor}`,
      `🔖 ${params.ref}`,
      params.createdBy ? `\nAdded by: ${params.createdBy}` : null,
    ].filter((l): l is string => l !== null).join('\n')

    for (const phone of phones) {
      sendWhatsAppMessage(phone, message).catch(() => {})
    }
  }

  export async function notifyStaffOfCancellation(params: {
    guestName: string
    time: string
    floor: string
    ref: string
  }): Promise<void> {
    const phones = await getStaffPhones(['manager', 'host'])
    const message = [
      `⚠️ *Booking Cancelled*`,
      ``,
      `👤 ${params.guestName} · ${fmtTimeIST(params.time)} · ${floorLabel[params.floor] ?? params.floor}`,
      `🔖 ${params.ref}`,
      ``,
      `The slot is now free.`,
    ].join('\n')

    for (const phone of phones) {
      sendWhatsAppMessage(phone, message).catch(() => {})
    }
  }

  // ── Cron Registration ──────────────────────────────────────────────────────────

  export function startReminderJob(): void {
    cron.schedule('*/10 * * * *', () => {
      sendBookingReminders().catch(err => console.error('[reminder] Reminders failed:', err))
    })
    cron.schedule('*/30 * * * *', () => {
      sendPostMealFeedback().catch(err => console.error('[reminder] Feedback failed:', err))
    })
    cron.schedule('30 11 * * *', () => {
      sendEveningBriefing().catch(err => console.error('[reminder] Briefing failed:', err))
    })
    cron.schedule('* * * * *', () => {
      markNoShows().catch(err => console.error('[reminder] No-show failed:', err))
    })
    cron.schedule('*/10 * * * *', () => {
      sendDayOfMessages().catch(err => console.error('[reminder] Day-of failed:', err))
    })
    console.log('[reminder] Cron jobs started')
  }
  ```

- [ ] **Step 2: Verify TypeScript**

  ```bash
  cd /Users/harshagrahal/Documents/Sanadige/backend && npx tsc --noEmit
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add backend/src/services/reminder.ts
  git commit -m "feat(backend): migrate reminder service to firestore"
  ```

---

## Task 10: Remove Supabase from Backend Entirely

**Files:**
- Delete: `backend/src/lib/supabase.ts`
- Delete: `backend/src/routes/auth.ts`
- Modify: `backend/src/index.ts`

- [ ] **Step 1: Delete `backend/src/lib/supabase.ts`**

  ```bash
  rm /Users/harshagrawal/Documents/Sanadige/backend/src/lib/supabase.ts
  ```

- [ ] **Step 2: Delete `backend/src/routes/auth.ts`**

  ```bash
  rm /Users/harshagrawal/Documents/Sanadige/backend/src/routes/auth.ts
  ```

- [ ] **Step 3: Remove auth router from `backend/src/index.ts`**

  Open `backend/src/index.ts`. Remove:
  - `import { authRouter } from './routes/auth'`
  - `app.use('/auth', authRouter)`

  Also remove any `import { supabase } from './lib/supabase'` if present.

- [ ] **Step 4: Verify TypeScript**

  ```bash
  cd /Users/harshagrayal/Documents/Sanadige/backend && npx tsc --noEmit
  ```

  Expected: no errors.

- [ ] **Step 5: Commit**

  ```bash
  git add -A
  git commit -m "chore(backend): remove supabase library and auth route"
  ```

---

## Task 11: Dashboard Firebase Libraries

**Files:**
- Create: `dashboard/src/lib/firebase-admin.ts`
- Create: `dashboard/src/lib/firebase-client.ts`

- [ ] **Step 1: Create `dashboard/src/lib/firebase-admin.ts`**

  ```typescript
  import { initializeApp, getApps, cert, App } from 'firebase-admin/app'
  import { getFirestore, Firestore } from 'firebase-admin/firestore'
  import { getAuth, Auth } from 'firebase-admin/auth'

  function getAdminApp(): App {
    if (getApps().length) return getApps()[0]!
    return initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID!,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
        privateKey: process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, '\n'),
      }),
    })
  }

  export function getAdminDb(): Firestore {
    return getFirestore(getAdminApp())
  }

  export function getAdminAuth(): Auth {
    return getAuth(getAdminApp())
  }
  ```

- [ ] **Step 2: Create `dashboard/src/lib/firebase-client.ts`**

  ```typescript
  import { initializeApp, getApps, FirebaseApp } from 'firebase/app'
  import { getAuth, Auth } from 'firebase/auth'
  import { getFirestore, Firestore } from 'firebase/firestore'

  const firebaseConfig = {
    apiKey:    process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
    appId:     process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
  }

  function getClientApp(): FirebaseApp {
    if (getApps().length) return getApps()[0]!
    return initializeApp(firebaseConfig)
  }

  export function getClientAuth(): Auth {
    return getAuth(getClientApp())
  }

  export function getClientDb(): Firestore {
    return getFirestore(getClientApp())
  }
  ```

- [ ] **Step 3: Verify TypeScript**

  ```bash
  cd /Users/harshagrawal/Documents/Sanadige/dashboard && npx tsc --noEmit
  ```

- [ ] **Step 4: Commit**

  ```bash
  git add dashboard/src/lib/firebase-admin.ts dashboard/src/lib/firebase-client.ts
  git commit -m "feat(dashboard): add firebase admin and client singletons"
  ```

---

## Task 12: Dashboard Auth — Session Cookies + Login Page

**Files:**
- Rewrite: `dashboard/src/lib/auth.ts`
- Create: `dashboard/src/app/api/auth/session/route.ts`
- Rewrite: `dashboard/src/app/login/page.tsx`

- [ ] **Step 1: Rewrite `dashboard/src/lib/auth.ts`**

  ```typescript
  import { cookies } from 'next/headers'
  import { getAdminAuth, getAdminDb } from './firebase-admin'

  export type Role = 'manager' | 'host' | 'waiter' | 'chef'

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
      const uid = decoded.uid
      const claims = decoded as { role?: Role; name?: string; phone_number?: string }

      if (!claims.role) return null

      return {
        uid,
        phone: claims.phone_number ?? '',
        name: claims.name ?? '',
        role: claims.role,
      }
    } catch {
      return null
    }
  }
  ```

- [ ] **Step 2: Create `dashboard/src/app/api/auth/session/route.ts`**

  ```typescript
  import { NextRequest, NextResponse } from 'next/server'
  import { getAdminAuth } from '@/lib/firebase-admin'
  import { cookies } from 'next/headers'

  export async function POST(req: NextRequest) {
    const { idToken } = await req.json()
    if (!idToken) return NextResponse.json({ error: 'Missing idToken' }, { status: 400 })

    try {
      const adminAuth = getAdminAuth()
      const expiresIn = 60 * 60 * 24 * 5 * 1000 // 5 days
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
  ```

- [ ] **Step 3: Rewrite `dashboard/src/app/login/page.tsx`**

  ```typescript
  'use client'
  import { useState, useRef } from 'react'
  import { useRouter } from 'next/navigation'
  import { getClientAuth } from '@/lib/firebase-client'
  import {
    signInWithPhoneNumber,
    RecaptchaVerifier,
    ConfirmationResult,
  } from 'firebase/auth'

  export default function LoginPage() {
    const [phone, setPhone] = useState('')
    const [otp, setOtp] = useState('')
    const [step, setStep] = useState<'phone' | 'otp'>('phone')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const confirmationRef = useRef<ConfirmationResult | null>(null)
    const recaptchaRef = useRef<RecaptchaVerifier | null>(null)
    const router = useRouter()

    async function sendOtp() {
      setError('')
      setLoading(true)
      try {
        const auth = getClientAuth()
        if (!recaptchaRef.current) {
          recaptchaRef.current = new RecaptchaVerifier(auth, 'recaptcha-container', { size: 'invisible' })
        }
        const e164 = phone.startsWith('+') ? phone : `+91${phone.replace(/\D/g, '')}`
        const result = await signInWithPhoneNumber(auth, e164, recaptchaRef.current)
        confirmationRef.current = result
        setStep('otp')
      } catch (err: unknown) {
        setError((err as Error).message ?? 'Failed to send OTP')
      } finally {
        setLoading(false)
      }
    }

    async function verifyOtp() {
      if (!confirmationRef.current) return
      setError('')
      setLoading(true)
      try {
        const result = await confirmationRef.current.confirm(otp)
        const idToken = await result.user.getIdToken()
        const res = await fetch('/api/auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken }),
        })
        if (!res.ok) throw new Error('Session creation failed')
        router.push('/dashboard')
      } catch (err: unknown) {
        setError((err as Error).message ?? 'Invalid OTP')
      } finally {
        setLoading(false)
      }
    }

    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-full max-w-sm p-8 bg-card rounded-2xl shadow-lg border border-border">
          <h1 className="text-2xl font-bold text-foreground mb-1">Sanadige</h1>
          <p className="text-sm text-muted-foreground mb-8">Staff sign-in</p>

          {step === 'phone' ? (
            <>
              <label className="block text-sm font-medium text-foreground mb-1.5">Phone number</label>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm mb-4"
              />
              <div id="recaptcha-container" />
              {error && <p className="text-xs text-rose-600 mb-3">{error}</p>}
              <button
                onClick={sendOtp}
                disabled={loading || !phone}
                className="w-full h-10 bg-primary text-primary-foreground rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {loading ? 'Sending…' : 'Send OTP'}
              </button>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground mb-4">Enter the code sent to {phone}</p>
              <input
                type="text"
                value={otp}
                onChange={e => setOtp(e.target.value)}
                placeholder="6-digit code"
                maxLength={6}
                className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm mb-4 tracking-widest text-center"
              />
              {error && <p className="text-xs text-rose-600 mb-3">{error}</p>}
              <button
                onClick={verifyOtp}
                disabled={loading || otp.length < 6}
                className="w-full h-10 bg-primary text-primary-foreground rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {loading ? 'Verifying…' : 'Sign in'}
              </button>
              <button onClick={() => setStep('phone')} className="w-full mt-2 text-xs text-muted-foreground underline">
                Change number
              </button>
            </>
          )}
        </div>
      </div>
    )
  }
  ```

- [ ] **Step 4: Delete old Supabase auth files**

  ```bash
  rm -f /Users/harshagrayal/Documents/Sanadige/dashboard/src/lib/supabase.ts
  rm -f /Users/harshagrayal/Documents/Sanadige/dashboard/src/lib/supabase-browser.ts
  rm -f /Users/harshagrayal/Documents/Sanadige/dashboard/src/actions/auth.ts
  ```

- [ ] **Step 5: Verify TypeScript**

  ```bash
  cd /Users/harshagrawal/Documents/Sanadige/dashboard && npx tsc --noEmit
  ```

- [ ] **Step 6: Commit**

  ```bash
  git add -A
  git commit -m "feat(dashboard): firebase phone auth + session cookie login"
  ```

---

## Task 13: Migrate Dashboard Server Actions to Firestore

**Files:**
- Rewrite: `dashboard/src/actions/bookings.ts`
- Rewrite: `dashboard/src/actions/guests.ts`

- [ ] **Step 1: Rewrite `dashboard/src/actions/bookings.ts`**

  ```typescript
  'use server'
  import { revalidatePath } from 'next/cache'
  import { getAdminDb } from '@/lib/firebase-admin'
  import { backendPost } from '@/lib/backend'

  function generateRef() {
    return 'SND-' + Math.random().toString(36).substring(2, 8).toUpperCase()
  }

  function revalidateAll() {
    revalidatePath('/dashboard/bookings')
    revalidatePath('/dashboard')
  }

  export async function createBooking(data: {
    guest_name: string
    phone: string
    party_size: number
    datetime: string
    floor: string
    special_notes?: string
    occasion?: string
    email?: string
  }) {
    const db = getAdminDb()
    const booking_ref = generateRef()

    await db.collection('bookings').add({
      ...data,
      booking_ref,
      whatsapp_id: data.phone,
      status: 'confirmed',
      channel: 'phone',
      reminder_sent_at: null,
      dayof_sent_at: null,
      feedback_sent_at: null,
      checked_in_at: null,
      completed_at: null,
      no_show_at: null,
      created_at: new Date().toISOString(),
    })

    await backendPost('/bookings/confirm', {
      phone: data.phone,
      guest_name: data.guest_name,
      booking_ref,
      datetime: data.datetime,
      party_size: data.party_size,
      floor: data.floor,
    }).catch(() => {})

    revalidateAll()
  }

  export async function updateBookingStatus(
    id: string,
    status: 'confirmed' | 'seated' | 'no_show' | 'cancelled' | 'checked_in' | 'completed'
  ) {
    const db = getAdminDb()
    const updates: Record<string, unknown> = { status }
    if (status === 'checked_in') updates.checked_in_at = new Date().toISOString()
    if (status === 'completed') updates.completed_at = new Date().toISOString()
    if (status === 'no_show') updates.no_show_at = new Date().toISOString()

    await db.collection('bookings').doc(id).update(updates)
    revalidateAll()
  }

  export async function cancelBooking(id: string) {
    const db = getAdminDb()
    await db.collection('bookings').doc(id).update({ status: 'cancelled' })
    revalidateAll()
  }

  export async function assignTable(bookingId: string, tableId: string) {
    const db = getAdminDb()
    await db.collection('bookings').doc(bookingId).update({ table_id: tableId, status: 'seated' })
    revalidateAll()
  }
  ```

- [ ] **Step 2: Rewrite `dashboard/src/actions/guests.ts`**

  ```typescript
  'use server'
  import { revalidatePath } from 'next/cache'
  import { getAdminDb } from '@/lib/firebase-admin'
  import { getSession } from '@/lib/auth'

  export async function addGuestNote(guestId: string, note: string) {
    const session = await getSession()
    if (!session) throw new Error('Unauthorized')
    const db = getAdminDb()
    await db.collection('guests').doc(guestId).collection('notes').add({
      note,
      added_by: session.name,
      created_at: new Date().toISOString(),
    })
    revalidatePath(`/dashboard/guests/${guestId}`)
  }

  export async function updateGuestTier(guestId: string, tier: 'standard' | 'preferred' | 'vip') {
    const db = getAdminDb()
    await db.collection('guests').doc(guestId).update({ tier })
    revalidatePath(`/dashboard/guests/${guestId}`)
    revalidatePath('/dashboard/guests')
  }

  export async function updateGuestPreferences(guestId: string, prefs: {
    dietary_notes?: string
    seating_preference?: string
  }) {
    const db = getAdminDb()
    await db.collection('guests').doc(guestId).update(prefs)
    revalidatePath(`/dashboard/guests/${guestId}`)
  }
  ```

- [ ] **Step 3: Verify TypeScript**

  ```bash
  cd /Users/harshagrawal/Documents/Sanadige/dashboard && npx tsc --noEmit
  ```

- [ ] **Step 4: Commit**

  ```bash
  git add dashboard/src/actions/bookings.ts dashboard/src/actions/guests.ts
  git commit -m "feat(dashboard): migrate booking and guest actions to firestore"
  ```

---

## Task 14: Migrate Dashboard Pages to Firestore

**Files:**
- Modify: `dashboard/src/app/dashboard/bookings/page.tsx`
- Modify: `dashboard/src/app/dashboard/guests/page.tsx`
- Modify: `dashboard/src/app/dashboard/guests/[id]/page.tsx`
- Modify: `dashboard/src/app/dashboard/page.tsx`

- [ ] **Step 1: Update bookings page**

  Open `dashboard/src/app/dashboard/bookings/page.tsx`. Replace any Supabase client call with:

  ```typescript
  import { getAdminDb } from '@/lib/firebase-admin'

  // Inside the async component:
  const db = getAdminDb()
  const dateIST = /* compute from searchParams */
  const snap = await db.collection('bookings')
    .where('datetime', '>=', `${dateIST}T00:00:00+05:30`)
    .where('datetime', '<=', `${dateIST}T23:59:59+05:30`)
    .orderBy('datetime')
    .get()
  const bookings = snap.docs.map(d => ({ id: d.id, ...d.data() }))
  ```

- [ ] **Step 2: Update guests list page**

  Open `dashboard/src/app/dashboard/guests/page.tsx`. Replace Supabase call with:

  ```typescript
  import { getAdminDb } from '@/lib/firebase-admin'

  const db = getAdminDb()
  const snap = await db.collection('guests').orderBy('name').get()
  const guests = snap.docs.map(d => ({ id: d.id, ...d.data() }))
  ```

- [ ] **Step 3: Update guest detail page**

  Open `dashboard/src/app/dashboard/guests/[id]/page.tsx`. Replace Supabase calls with:

  ```typescript
  import { getAdminDb } from '@/lib/firebase-admin'

  const db = getAdminDb()
  // Guest profile
  const guestDoc = await db.collection('guests').doc(params.id).get()
  const guest = { id: guestDoc.id, ...guestDoc.data() }

  // Booking history
  const bookingsSnap = await db.collection('bookings')
    .where('guest_id', '==', params.id)
    .orderBy('datetime', 'desc')
    .limit(20)
    .get()
  const bookingHistory = bookingsSnap.docs.map(d => ({ id: d.id, ...d.data() }))

  // Staff notes
  const notesSnap = await db.collection('guests').doc(params.id)
    .collection('notes').orderBy('created_at', 'desc').get()
  const notes = notesSnap.docs.map(d => ({ id: d.id, ...d.data() }))
  ```

- [ ] **Step 4: Update mission control (dashboard) page**

  Open `dashboard/src/app/dashboard/page.tsx`. Replace Supabase calls with Firestore equivalents using `getAdminDb()`. Today's bookings use the same date window query as the bookings page.

- [ ] **Step 5: Verify TypeScript**

  ```bash
  cd /Users/harshagrawal/Documents/Sanadige/dashboard && npx tsc --noEmit
  ```

- [ ] **Step 6: Commit**

  ```bash
  git add dashboard/src/app/dashboard
  git commit -m "feat(dashboard): migrate all pages to firestore reads"
  ```

---

## Task 15: Migrate BookingsTable Realtime to onSnapshot

**Files:**
- Modify: `dashboard/src/components/bookings/BookingsTable.tsx`

- [ ] **Step 1: Replace Supabase realtime with Firestore onSnapshot**

  Open `dashboard/src/components/bookings/BookingsTable.tsx`. Replace the `useEffect` that sets up the Supabase channel with:

  ```typescript
  import { getClientDb } from '@/lib/firebase-client'
  import { collection, query, where, onSnapshot } from 'firebase/firestore'

  // Inside the component:
  useEffect(() => {
    const db = getClientDb()
    const startISO = `${date}T00:00:00+05:30`
    const endISO   = `${date}T23:59:59+05:30`
    const q = query(
      collection(db, 'bookings'),
      where('datetime', '>=', startISO),
      where('datetime', '<=', endISO)
    )

    setLive(false)
    const unsub = onSnapshot(q, (snap) => {
      setLive(true)
      const updated = snap.docs.map(d => ({ id: d.id, ...d.data() }) as Booking)
      setRows(updated.sort((a, b) => a.datetime.localeCompare(b.datetime)))
    }, () => setLive(false))

    return () => unsub()
  }, [date])
  ```

  Remove the `getBrowserSupabase` import.

- [ ] **Step 2: Verify TypeScript**

  ```bash
  cd /Users/harshagrawal/Documents/Sanadige/dashboard && npx tsc --noEmit
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add dashboard/src/components/bookings/BookingsTable.tsx
  git commit -m "feat(dashboard): migrate bookings realtime from supabase to firestore onsnapshot"
  ```

---

## Task 16: Firestore Security Rules + Indexes

**Files:**
- Create: `firestore.rules`
- Create: `firestore.indexes.json`

- [ ] **Step 1: Create `firestore.rules` in project root**

  ```
  rules_version = '2';
  service cloud.firestore {
    match /databases/{database}/documents {
      // Authenticated users can read bookings (for onSnapshot in dashboard)
      match /bookings/{doc} {
        allow read: if request.auth != null;
        allow write: if false; // Admin SDK only
      }
      match /guests/{doc} {
        allow read: if request.auth != null;
        allow write: if false;
        match /notes/{note} {
          allow read: if request.auth != null;
          allow write: if false;
        }
      }
      match /staff/{doc} {
        allow read: if request.auth != null;
        allow write: if false;
      }
      match /conversations/{doc} {
        allow read, write: if false; // backend only
      }
    }
  }
  ```

- [ ] **Step 2: Create `firestore.indexes.json` in project root**

  ```json
  {
    "indexes": [
      {
        "collectionGroup": "bookings",
        "queryScope": "COLLECTION",
        "fields": [
          { "fieldPath": "status", "order": "ASCENDING" },
          { "fieldPath": "datetime", "order": "ASCENDING" }
        ]
      },
      {
        "collectionGroup": "bookings",
        "queryScope": "COLLECTION",
        "fields": [
          { "fieldPath": "floor", "order": "ASCENDING" },
          { "fieldPath": "status", "order": "ASCENDING" },
          { "fieldPath": "datetime", "order": "ASCENDING" }
        ]
      },
      {
        "collectionGroup": "bookings",
        "queryScope": "COLLECTION",
        "fields": [
          { "fieldPath": "guest_id", "order": "ASCENDING" },
          { "fieldPath": "datetime", "order": "DESCENDING" }
        ]
      },
      {
        "collectionGroup": "bookings",
        "queryScope": "COLLECTION",
        "fields": [
          { "fieldPath": "status", "order": "ASCENDING" },
          { "fieldPath": "reminder_sent_at", "order": "ASCENDING" },
          { "fieldPath": "datetime", "order": "ASCENDING" }
        ]
      },
      {
        "collectionGroup": "bookings",
        "queryScope": "COLLECTION",
        "fields": [
          { "fieldPath": "status", "order": "ASCENDING" },
          { "fieldPath": "dayof_sent_at", "order": "ASCENDING" },
          { "fieldPath": "datetime", "order": "ASCENDING" }
        ]
      },
      {
        "collectionGroup": "bookings",
        "queryScope": "COLLECTION",
        "fields": [
          { "fieldPath": "status", "order": "ASCENDING" },
          { "fieldPath": "feedback_sent_at", "order": "ASCENDING" },
          { "fieldPath": "datetime", "order": "ASCENDING" }
        ]
      },
      {
        "collectionGroup": "bookings",
        "queryScope": "COLLECTION",
        "fields": [
          { "fieldPath": "status", "order": "ASCENDING" },
          { "fieldPath": "checked_in_at", "order": "ASCENDING" },
          { "fieldPath": "datetime", "order": "ASCENDING" }
        ]
      }
    ],
    "fieldOverrides": []
  }
  ```

- [ ] **Step 3: Deploy rules and indexes**

  ```bash
  cd /Users/harshagrawal/Documents/Sanadige
  firebase deploy --only firestore:rules,firestore:indexes --project sanadige-prod
  ```

  Expected: `Deploy complete!`

- [ ] **Step 4: Commit**

  ```bash
  git add firestore.rules firestore.indexes.json
  git commit -m "chore: add firestore security rules and composite indexes"
  ```

---

## Task 17: Seed Initial Data

**Files:** None — one-time script run from terminal

- [ ] **Step 1: Create a seed script**

  Create `backend/scripts/seed-firestore.ts`:

  ```typescript
  import { initializeApp, cert } from 'firebase-admin/app'
  import { getFirestore } from 'firebase-admin/firestore'
  import * as dotenv from 'dotenv'
  dotenv.config()

  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID!,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
      privateKey: process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, '\n'),
    }),
  })

  const db = getFirestore()

  const tables = [
    // Terrace (6 tables)
    { floor: 'terrace', table_number: 'T1', capacity: 2 },
    { floor: 'terrace', table_number: 'T2', capacity: 2 },
    { floor: 'terrace', table_number: 'T3', capacity: 4 },
    { floor: 'terrace', table_number: 'T4', capacity: 4 },
    { floor: 'terrace', table_number: 'T5', capacity: 6 },
    { floor: 'terrace', table_number: 'T6', capacity: 8 },
    // Floor 1 (8 tables)
    { floor: 'floor1', table_number: 'F1-01', capacity: 2 },
    { floor: 'floor1', table_number: 'F1-02', capacity: 2 },
    { floor: 'floor1', table_number: 'F1-03', capacity: 4 },
    { floor: 'floor1', table_number: 'F1-04', capacity: 4 },
    { floor: 'floor1', table_number: 'F1-05', capacity: 4 },
    { floor: 'floor1', table_number: 'F1-06', capacity: 6 },
    { floor: 'floor1', table_number: 'F1-07', capacity: 6 },
    { floor: 'floor1', table_number: 'F1-08', capacity: 8 },
    // Floor 2 (7 tables)
    { floor: 'floor2', table_number: 'F2-01', capacity: 2 },
    { floor: 'floor2', table_number: 'F2-02', capacity: 2 },
    { floor: 'floor2', table_number: 'F2-03', capacity: 4 },
    { floor: 'floor2', table_number: 'F2-04', capacity: 4 },
    { floor: 'floor2', table_number: 'F2-05', capacity: 6 },
    { floor: 'floor2', table_number: 'F2-06', capacity: 6 },
    { floor: 'floor2', table_number: 'F2-07', capacity: 8 },
    // Private (1 table)
    { floor: 'private', table_number: 'P1', capacity: 20 },
  ]

  async function seed() {
    const batch = db.batch()
    for (const table of tables) {
      const ref = db.collection('tables').doc()
      batch.set(ref, { ...table, is_active: true })
    }
    await batch.commit()
    console.log(`Seeded ${tables.length} tables`)
    process.exit(0)
  }

  seed().catch(console.error)
  ```

- [ ] **Step 2: Run the seed script**

  ```bash
  cd /Users/harshagrayal/Documents/Sanadige/backend
  npx ts-node --project tsconfig.json scripts/seed-firestore.ts
  ```

  Expected: `Seeded 22 tables`

- [ ] **Step 3: Verify in Firebase Console**

  Go to Firebase Console → Firestore → Data → `tables` collection. You should see 22 documents.

- [ ] **Step 4: Seed the manager account**

  Ensure `MANAGER_PHONE` and `MANAGER_NAME` are set in `.env`, then start the backend once:

  ```bash
  cd /Users/harshagrayal/Documents/Sanadige/backend
  npm run dev
  ```

  The `seedManagerFromEnv()` call in `index.ts` will create the Firebase Auth user and Firestore staff document. Check the console for `[staff] Seeded manager:` log.

- [ ] **Step 5: Commit seed script**

  ```bash
  git add backend/scripts/seed-firestore.ts
  git commit -m "chore: add firestore seed script for tables"
  ```

---

## Verification Checklist

- [ ] `npx tsc --noEmit` passes in both `backend/` and `dashboard/` with zero errors
- [ ] Backend starts without errors: `cd backend && npm run dev`
- [ ] WhatsApp booking flow works end-to-end: send message → bot responds → booking appears in Firestore `bookings` collection
- [ ] Dashboard login: enter phone → receive SMS OTP → enter code → redirected to `/dashboard`
- [ ] Bookings page loads today's bookings from Firestore
- [ ] Real-time updates: create a booking via WhatsApp while dashboard is open → row appears without refresh
- [ ] Guest profile auto-created in `guests` collection when booking made via WhatsApp
- [ ] No-show cron: create a booking with `datetime` 25 minutes in the past → wait 1 minute → status changes to `no_show`
- [ ] `firebase deploy --only firestore:rules,firestore:indexes` succeeds
