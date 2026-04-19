# Sanadige Staff Dashboard

Role-aware internal web dashboard for Sanadige Delhi staff. Live at `dashboard.sanadige.in`.

## What it does

Staff sign in with their WhatsApp number — no passwords. A 6-digit OTP is sent via WhatsApp and verified. On success, a signed JWT is stored as an HTTP-only cookie that lasts 12 hours.

Every staff member lands on a different page based on their role:

| Role | Default page | Access |
|---|---|---|
| Manager | Mission Control (`/dashboard`) | All 6 sections |
| Chef | Today's Catch (`/dashboard/catch`) | Catch only |
| Host | Bookings (`/dashboard/bookings`) | Bookings + Floor Map |

## The 6 sections

**Mission Control** — Manager home. KPI cards (bookings today, available seats, catch live, estimated revenue), bookings bar chart with week/month toggle, upcoming bookings widget, catch status widget, activity feed, and staff-on-duty widget.

**Today's Catch** — Chefs and managers manage the day's catch. Click the status badge to cycle Available → Sold Out → Tomorrow. Add notes inline (saves on blur). Add new fish via drawer. Summary bar shows counts at a glance.

**Bookings** — Hosts and managers see today's bookings in a sortable table. Expand any row to see the booking ref, phone, and a direct WhatsApp link. Mark a booking as Seated or cancel it. Create new bookings via drawer (triggers a WhatsApp confirmation to the guest).

**Floor Map** — SVG plan of all 4 areas: Terrace (25 seats), Floor 1 (40), Floor 2 (35), Private Room (12). Tables show green (free), amber (booking within 2 hours), or red (seated).

**Staff** — Manager-only. View all staff with role-coloured avatars, edit roles inline, remove members (except the primary manager), and add new members. New members receive a WhatsApp welcome message automatically.

**Analytics** — Manager-only. 4 charts over the last 30 days: bookings trend (bar), floor distribution (donut), peak hours heatmap (Mon–Sun × 12:00–23:00), estimated revenue + 7-day moving average.

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14, App Router, TypeScript |
| Styling | Tailwind CSS + shadcn/ui (warm earthy palette) |
| Charts | Recharts |
| Auth | WhatsApp OTP → HS256 JWT in HTTP-only cookie (12h) |
| Database | Supabase (service role key, server-side only) |
| Backend | AWS EC2 + PM2 + nginx Express app (OTP send + WhatsApp confirmations) |
| Deploy | Vercel |

## Project structure

```
dashboard/
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx                    → /login or /dashboard
│   │   ├── login/page.tsx              WhatsApp OTP login
│   │   └── dashboard/
│   │       ├── layout.tsx              Shell: sidebar + topbar + auth gate
│   │       ├── page.tsx                Role-based redirect
│   │       ├── _components/            MissionControl server component
│   │       ├── catch/page.tsx
│   │       ├── bookings/page.tsx
│   │       ├── floor/page.tsx
│   │       ├── staff/page.tsx
│   │       └── analytics/page.tsx
│   ├── components/
│   │   ├── shell/                      Sidebar, Topbar
│   │   ├── home/                       KpiRow, BookingsChart, widgets
│   │   ├── catch/                      CatchCard, AddCatchDrawer
│   │   ├── bookings/                   BookingsTable, NewBookingDrawer
│   │   ├── floor/                      FloorMap (inline SVG)
│   │   ├── staff/                      StaffCard, AddStaffDrawer
│   │   ├── analytics/                  4 chart components
│   │   └── ui/                         shadcn/ui primitives
│   ├── actions/
│   │   ├── auth.ts                     sendOtp, verifyOtp, getSession, logout
│   │   ├── catch.ts                    toggleCatch, updateNote, addCatch
│   │   ├── bookings.ts                 createBooking, updateBookingStatus
│   │   └── staff.ts                    addStaff, updateStaffRole, removeStaff
│   ├── lib/
│   │   ├── auth.ts                     JWT sign/verify (jose, HS256)
│   │   ├── supabase.ts                 Server-side Supabase client (service role)
│   │   ├── supabase-browser.ts         Client-side Supabase client (anon, Realtime)
│   │   └── backend.ts                  Typed fetch wrapper for App Runner backend
│   └── middleware.ts                   JWT validation + role-based route protection
└── vercel.json
```

## Running locally

```bash
cd dashboard
npm install
# Copy .env.local and fill in real values (see SETUP.md)
npm run dev
```

Open `http://localhost:3000` — redirects to `/login`.

## Environment variables

| Variable | Description |
|---|---|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key — **server-side only, never expose to browser** |
| `SUPABASE_ANON_KEY` | Anon key |
| `NEXT_PUBLIC_SUPABASE_URL` | Same as `SUPABASE_URL` — sent to browser for Realtime |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key sent to browser for Realtime |
| `JWT_SECRET` | Random 32+ byte secret for signing session JWTs |
| `BACKEND_URL` | Base URL of the App Runner backend |

Generate a secure JWT_SECRET:
```bash
openssl rand -base64 32
```

## Tests

```bash
npm test            # run once
npm run test:watch  # watch mode
```

2 tests cover the JWT auth library: sign + verify round-trip, and tampered token rejection.

## Full setup instructions

See `SETUP.md` for step-by-step instructions to go from zero to a live production deployment.
