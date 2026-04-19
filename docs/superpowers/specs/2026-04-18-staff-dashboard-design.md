# Sanadige Staff Dashboard — Design Spec
**Plan 2 of 3 · April 18, 2026**

---

## Overview

A role-aware internal web dashboard for Sanadige Delhi staff. Deployed at `dashboard.sanadige.in`. Managers get a real-time mission control home with full access to all sections. Chefs land directly on catch management. Hosts land on bookings. All authentication is via WhatsApp OTP — no passwords.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router), TypeScript |
| Styling | Tailwind CSS + shadcn/ui (customised to warm earthy palette) |
| Charts | Recharts |
| Auth | Custom WhatsApp OTP + signed JWT (HTTP-only cookie) |
| Database | Supabase (server-side service role — key never reaches browser) |
| Realtime | Supabase Realtime (catch + bookings live updates) |
| Deploy | Vercel |

---

## Visual Design

**Theme:** Warm Light — Coastal Earthy

| Token | Value |
|---|---|
| Background | `#f8f7f4` (off-white) |
| Surface (cards) | `#ffffff` |
| Border | `#e8e3dc` |
| Primary | `#1a3a2a` (forest green) |
| Primary gradient | `linear-gradient(135deg, #1a3a2a, #2d5a3d)` |
| Accent | `#c8956c` (terracotta) |
| Success | `#22c55e` |
| Danger | `#ef4444` |
| Warning | `#f59e0b` |
| Text primary | `#1a2e1a` |
| Text muted | `#9ca3af` |

**Layout shell:** Wide persistent sidebar (220px) with labelled nav links + top bar. Sidebar collapses to icon-only on tablet (< 768px).

**Typography:** System font stack (`-apple-system, BlinkMacSystemFont, "Segoe UI"`). Page titles 20px/700. Section labels 10px/700 uppercase with letter-spacing.

---

## Authentication

### Flow
1. Staff navigates to `dashboard.sanadige.in/login`
2. Enters their WhatsApp phone number (must exist in the `staff` table)
3. Dashboard Server Action calls App Runner `POST /auth/send-otp` → App Runner sends a 6-digit OTP via WhatsApp to that number
4. OTP stored in Supabase `staff_otps` table with a 10-minute expiry
5. Staff enters the 6-digit code
6. Server Action verifies code against `staff_otps`, checks expiry, looks up staff record
7. On success: signed JWT created with `{ phone, name, role, exp }` using a `JWT_SECRET` env var
8. JWT stored as an HTTP-only, Secure, SameSite=Strict cookie named `snd_session`
9. Redirect to `/dashboard` (role determines the landing view)

### Route Protection
Next.js middleware reads `snd_session` cookie on every request. Missing or invalid JWT → redirect to `/login`. Wrong role for a protected route → redirect to role's default page.

### New Supabase Table: `staff_otps`
```sql
create table staff_otps (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  code text not null,
  expires_at timestamptz not null,
  used boolean default false,
  created_at timestamptz default now()
);
-- Auto-cleanup: delete used/expired rows via Supabase cron or on each login attempt
```

### App Runner endpoint: `POST /auth/send-otp`
New endpoint added to the existing Express backend. Accepts `{ phone }`, generates a 6-digit code, writes to `staff_otps`, sends via WhatsApp.

---

## Pages & Route Access

| Route | Manager | Chef | Host | Notes |
|---|---|---|---|---|
| `/login` | Public | Public | Public | |
| `/dashboard` | Mission Control | → `/dashboard/catch` | → `/dashboard/bookings` | Role-based redirect |
| `/dashboard/catch` | ✓ | ✓ | — | |
| `/dashboard/bookings` | ✓ | — | ✓ | |
| `/dashboard/floor` | ✓ | — | ✓ | |
| `/dashboard/staff` | ✓ | — | — | Manager only |
| `/dashboard/analytics` | ✓ | — | — | Manager only |

---

## Sections

### 1. Mission Control (`/dashboard`) — Manager only

**Layout:** Full-width content area. No sub-navigation.

**KPI Row (4 cards):**
- Today's Bookings — count from `bookings` where date = today and status = confirmed
- Available Seats — 142 (total capacity) minus booked seats today
- Catch Live — `X/Y` count of available items vs total in `daily_availability` for today
- Revenue Today — sum of estimated revenue from today's confirmed bookings (party_size × avg spend ₹2000)

**Bookings Chart:**
- Bar chart (Recharts `BarChart`) — bookings count per day for the current week
- Week / Month toggle — switches between 7-day and 30-day view
- Bar colour: `#1a3a2a` at full opacity for today, lighter for other days

**Upcoming Bookings widget:**
- Next 5 upcoming bookings for today ordered by datetime
- Each row: time, guest name, party size, floor tag (colour-coded: Terrace=amber, Floor 1=blue, Floor 2=green, Private=pink)
- "View all →" link to `/dashboard/bookings`

**Today's Catch widget:**
- 2-column grid of catch items with coloured dot (green/red/amber)
- "Manage →" link to `/dashboard/catch`

**Activity Feed:**
- Last 10 events from an `activity_log` Supabase table (catch updates, new bookings, staff changes, WhatsApp query count)

**Staff on Duty widget:**
- All staff from `staff` table
- Role-coloured avatar (manager=green, chef=orange, host=blue)
- "Manage →" link to `/dashboard/staff`

**Realtime:** Supabase channel subscription on `bookings` and `daily_availability` — KPI cards and widgets update live.

---

### 2. Today's Catch (`/dashboard/catch`) — Chef + Manager

**Layout:** Header with summary bar, then card grid.

**Summary Bar:** 4 metrics — Available count, Sold Out count, Tomorrow count, Total Items.

**Card Grid (2 columns):**
Each card represents one `catch_items` row joined with today's `daily_availability`:
- Coloured left-border accent (green=available, red=sold-out, amber=tomorrow)
- Fish name + local region
- Toggle switch — clicking calls a Server Action to upsert `daily_availability` for today
- Prep chips — from `catch_items.recommended_preps[]`
- Editable note field — inline textarea, saves on blur via Server Action
- Status pill (Available / Sold Out / Tomorrow)

**Add Item button:** Opens a drawer — fish name, region, recommended preps (comma-separated), spice level. Creates a new `catch_items` row and today's `daily_availability` entry.

**History button:** Shows a modal with `daily_availability` records for the past 7 days.

**Realtime:** Supabase subscription — if manager or another chef updates via WhatsApp, cards update live.

---

### 3. Bookings (`/dashboard/bookings`) — Host + Manager

**Layout:** Filter bar + sortable table.

**Filter Bar:** Date picker (defaults to today), floor dropdown (All / Terrace / Floor 1 / Floor 2 / Private), status dropdown (All / Confirmed / Seated / No-show / Cancelled).

**Table Columns:** Time, Guest Name, Party Size, Floor (coloured tag), Special Notes (truncated), Status (coloured badge), Actions.

**Row Actions:**
- Mark Seated — updates `status = 'seated'`
- Cancel — updates `status = 'cancelled'`, confirmation dialog first
- Expand row — shows full booking details including `booking_ref`, phone, WhatsApp link

**New Booking button:** Drawer form — guest name, phone, party size, date/time, floor, special notes. Server Action writes to `bookings` and triggers WhatsApp confirmation message via App Runner.

**Realtime:** New bookings appear live (Supabase subscription).

---

### 4. Floor Map (`/dashboard/floor`) — Host + Manager

**Layout:** SVG floor plan (inline, responsive). Legend below.

**Floors shown:** Terrace (cap 25), Floor 1 (cap 40), Floor 2 (cap 35), Private Room (cap 12).

**Table states:**
- Green — no confirmed booking in the next 2 hours
- Amber — booking confirmed, not yet seated
- Red — currently seated

**Interaction:** Click a table → tooltip with booking details if booked, or "Book this table" button if free.

**Implementation:** SVG with Supabase realtime subscription. Table positions are hardcoded in a config object. State is derived from `bookings` for today ± 2h.

---

### 5. Staff Management (`/dashboard/staff`) — Manager only

**Layout:** Summary bar + card list + add form.

**Summary Bar:** Manager count, Chef count, Host count, Total.

**Staff Cards:**
- Role-coloured avatar (initials)
- Name, phone number, role badge, added date
- Edit icon → inline role change dropdown + save
- Delete icon → confirmation dialog → Server Action deletes from `staff` table
- Primary manager card (from `MANAGER_PHONE` env): green tint, "✓ Primary" badge, no delete button

**Add Staff:** "＋ Add new staff member" card at the bottom. Clicking opens an inline form or drawer — name, phone, role. Server Action upserts into `staff` table. The new staff member immediately receives a WhatsApp message welcoming them and explaining they now have dashboard access.

---

### 6. Analytics (`/dashboard/analytics`) — Manager only

**Layout:** Date range picker at top, then 4 chart sections.

**Bookings Trend:** `BarChart` — bookings per day for selected range. Week / Month / Custom range.

**Popular Floors:** `PieChart` (donut) — bookings split by floor.

**Peak Hours Heatmap:** Grid (hour 12pm–11pm × day Mon–Sun) — cell colour intensity based on booking count. Darker = busier. Helps identify when to add more staff.

**Revenue Trend:** `LineChart` — estimated revenue per day (party_size × ₹2000 avg). Overlaid with a 7-day moving average line.

---

## New Backend Endpoint (App Runner)

### `POST /auth/send-otp`
Request: `{ phone: string }`
- Validates phone exists in `staff` table
- Generates 6-digit code
- Writes to `staff_otps` (expires in 10 min, clears old entries for same phone)
- Sends WhatsApp message: `Your Sanadige dashboard OTP is: 123456. Valid for 10 minutes.`
- Response: `{ ok: true }` (never reveals whether phone exists — always 200)

### `POST /auth/verify-otp` (handled in Next.js Server Action — not on App Runner)
- Reads `staff_otps` for matching phone + code + not expired + not used
- Marks used = true
- Looks up staff record
- Creates signed JWT
- Sets cookie

---

## New Supabase Table: `activity_log`

```sql
create table activity_log (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,   -- 'catch_update' | 'booking_new' | 'booking_status' | 'staff_change' | 'whatsapp_query'
  description text not null,
  actor_phone text,           -- who triggered it (staff phone or null for Claude)
  metadata jsonb,
  created_at timestamptz default now()
);
```

Backend and dashboard Server Actions write to this table on significant events.

---

## File Structure

```
dashboard/                          # Next.js 14 app (separate from backend/)
├── src/
│   ├── app/
│   │   ├── layout.tsx              # Root layout — font, metadata
│   │   ├── page.tsx                # / → redirect to /dashboard or /login
│   │   ├── login/
│   │   │   └── page.tsx            # Phone entry + OTP verify UI
│   │   └── dashboard/
│   │       ├── layout.tsx          # Shell: sidebar + topbar, auth check
│   │       ├── page.tsx            # Role-based redirect
│   │       ├── catch/page.tsx
│   │       ├── bookings/page.tsx
│   │       ├── floor/page.tsx
│   │       ├── staff/page.tsx
│   │       └── analytics/page.tsx
│   ├── components/
│   │   ├── shell/
│   │   │   ├── Sidebar.tsx
│   │   │   └── Topbar.tsx
│   │   ├── catch/
│   │   │   ├── CatchCard.tsx
│   │   │   ├── CatchGrid.tsx
│   │   │   └── AddCatchDrawer.tsx
│   │   ├── bookings/
│   │   │   ├── BookingsTable.tsx
│   │   │   ├── BookingRow.tsx
│   │   │   └── NewBookingDrawer.tsx
│   │   ├── floor/
│   │   │   └── FloorMap.tsx
│   │   ├── staff/
│   │   │   ├── StaffCard.tsx
│   │   │   └── AddStaffDrawer.tsx
│   │   ├── analytics/
│   │   │   ├── BookingsTrend.tsx
│   │   │   ├── FloorDonut.tsx
│   │   │   ├── PeakHoursHeatmap.tsx
│   │   │   └── RevenueTrend.tsx
│   │   └── home/
│   │       ├── KpiRow.tsx
│   │       ├── BookingsChart.tsx
│   │       ├── UpcomingBookings.tsx
│   │       ├── CatchWidget.tsx
│   │       ├── ActivityFeed.tsx
│   │       └── StaffWidget.tsx
│   ├── lib/
│   │   ├── supabase.ts             # Server-side Supabase client (service role)
│   │   ├── supabase-browser.ts     # Client-side Supabase client (anon, for realtime only)
│   │   ├── auth.ts                 # JWT sign/verify using jose
│   │   └── backend.ts            # Typed fetch wrapper for App Runner API
│   ├── actions/
│   │   ├── auth.ts                 # sendOtp, verifyOtp Server Actions
│   │   ├── catch.ts                # toggleCatch, updateNote, addCatch Server Actions
│   │   ├── bookings.ts             # createBooking, updateStatus Server Actions
│   │   └── staff.ts                # addStaff, updateStaff, removeStaff Server Actions
│   └── middleware.ts               # JWT validation + route protection
├── .env.local                      # SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, JWT_SECRET, BACKEND_URL
├── next.config.ts
├── tailwind.config.ts
└── package.json
```

---

## Environment Variables (dashboard)

| Variable | Description |
|---|---|
| `SUPABASE_URL` | Same Supabase project as backend |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side only — never sent to browser |
| `SUPABASE_ANON_KEY` | Client-side — for Realtime subscriptions only |
| `JWT_SECRET` | Random 32-byte secret for signing session JWTs |
| `BACKEND_URL` | Base URL of the App Runner backend (for OTP send + booking WhatsApp confirm) |

---

## Deployment

- **Platform:** Vercel
- **Domain:** `dashboard.sanadige.in`
- **Build command:** `next build`
- **Environment variables:** Set in Vercel dashboard under project settings
- **Preview deployments:** Automatically created for every git push (for testing before going live)
