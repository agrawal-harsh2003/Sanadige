# Setup Guide — Sanadige Staff Dashboard

Complete step-by-step instructions to go from zero to a live dashboard at `dashboard.sanadige.in`. Follow every section in order. Each step tells you exactly what to do, what to expect, and how to verify it worked.

---

## Prerequisites

Before you start, make sure you have:

- **Node.js 20+** — check with `node --version`. Download from [nodejs.org](https://nodejs.org).
- **npm 9+** — comes with Node. Check with `npm --version`.
- **Git** — check with `git --version`.
- **Vercel CLI** — install with `npm install -g vercel`. Verify with `vercel --version`.
- **A running Sanadige backend** — the EC2 backend must be deployed and reachable at `https://api.sanadige.in`. The dashboard calls it to send OTPs and WhatsApp confirmations. See `backend/SETUP.md` if it is not yet deployed.
- **A Supabase project** — the same one used by the backend. You need the URL, service role key, and anon key.
- **A custom domain** (`dashboard.sanadige.in`) — you need access to the DNS settings for `sanadige.in`.
- **A Vercel account** — free tier is fine. Sign up at [vercel.com](https://vercel.com).

---

## How the system fits together

```
Browser
  │
  ├─── GET /login ──────────────────────────────────► Vercel (Next.js 14)
  │                                                       │
  │    [enter phone] ──► sendOtp() Server Action          │
  │                          │                            │
  │                          └─► POST /auth/send-otp ──► EC2 / nginx (Express)
  │                                                          │
  │                                                          ├─► Supabase: check staff table
  │                                                          ├─► Supabase: insert staff_otps
  │                                                          └─► WhatsApp Cloud API: send OTP
  │
  │    [enter OTP] ──► verifyOtp() Server Action
  │                        │
  │                        ├─► Supabase: verify staff_otps
  │                        ├─► Supabase: fetch staff record
  │                        ├─► Sign JWT with JWT_SECRET
  │                        └─► Set snd_session cookie (HTTP-only, 12h)
  │
  └─── GET /dashboard ──► Next.js middleware validates cookie ──► render page
                              │
                              └─► Server components query Supabase directly
                                  (service role key, never reaches browser)
```

Key security properties:
- The Supabase **service role key** only ever exists on the server (Vercel edge/Node runtime). It is never sent to the browser.
- The **JWT** is in an HTTP-only cookie — JavaScript in the browser cannot read it.
- The OTP endpoint always returns `{ ok: true }` regardless of whether the phone exists, so you cannot probe the staff list by trying different numbers.
- JWTs expire after 12 hours.

---

## Step 1 — Clone and install

If you are starting from the repository root:

```bash
git clone <repo-url> sanadige
cd sanadige/dashboard
npm install
```

Expected output: dependency tree installed with no errors. `node_modules/` is created.

If you already have the repo cloned and just need to install the dashboard dependencies:

```bash
cd dashboard
npm install
```

---

## Step 2 — Run the Supabase migration

The dashboard needs two extra tables that the original backend schema does not include: `staff_otps` (for OTP codes) and `activity_log` (for the Mission Control activity feed).

1. Open your Supabase project at [supabase.com](https://supabase.com).
2. In the left sidebar, click **SQL Editor**.
3. Click **New query**.
4. Open the file `backend/src/db/migrations/002_dashboard_tables.sql` from this repository and copy its entire contents.
5. Paste into the SQL Editor and click **Run** (or press `Cmd+Enter` / `Ctrl+Enter`).

You should see: **"Success. No rows returned."**

**Verify it worked:** Click **Table Editor** in the left sidebar. You should now see `staff_otps` and `activity_log` in addition to the existing tables.

**What these tables do:**

`staff_otps` — Stores the 6-digit OTP codes temporarily. Each row has a phone number, the code, an expiry timestamp (10 minutes from creation), and a `used` flag. When staff verify an OTP, the row is marked used. Old unused OTPs for the same phone are deleted before a new one is inserted, so only the most recent code is ever valid.

`activity_log` — Stores a feed of significant events: catch updates, new bookings, booking status changes, staff changes, and WhatsApp queries. The Mission Control page reads the 10 most recent rows to show the activity feed. The backend and dashboard Server Actions write to this table (wiring up all write points is an extension point — the table and read query are in place).

---

## Step 3 — Get your Supabase credentials

You need three values from your Supabase project:

1. Go to **Project Settings** → **API** in your Supabase dashboard.
2. Copy:
   - **Project URL** (e.g. `https://abcdefgh.supabase.co`) → this is `SUPABASE_URL`
   - **service_role** key (under "Project API keys", click the eye icon to reveal) → this is `SUPABASE_SERVICE_ROLE_KEY`
   - **anon / public** key → this is `SUPABASE_ANON_KEY` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Keep the service role key secret — it bypasses Row Level Security and has full database access. It must never be committed to git or sent to the browser.

---

## Step 4 — Get your backend URL

The dashboard calls the EC2 backend to send OTPs and WhatsApp booking confirmations.

If you set up a custom domain with nginx + Certbot (Step 11i in `backend/SETUP.md`), your `BACKEND_URL` is:

```
https://api.sanadige.in
```

If you have not yet set up a domain, you can temporarily use the EC2 public IP with HTTP (not suitable for production, but fine for local testing):

```
http://YOUR_SERVER_IP:3000
```

If the backend is not yet deployed, follow `backend/SETUP.md` first and return here.

---

## Step 5 — Generate a JWT secret

The dashboard signs session JWTs with a secret key. Generate a cryptographically secure one:

```bash
openssl rand -base64 32
```

Example output (yours will be different):
```
7Kp3mR9vQnXwYzLfDsGhJoUiEtNcBaWp2MxVqAkCeH4=
```

Copy this value — it becomes your `JWT_SECRET`. Keep it secret. If it leaks, anyone can forge a session cookie.

---

## Step 6 — Create the local environment file

In the `dashboard/` directory, create a file called `.env.local`:

```bash
cd dashboard
```

Create the file with your actual values (replace every `REPLACE_WITH_...` below):

```
SUPABASE_URL=REPLACE_WITH_YOUR_PROJECT_URL
SUPABASE_SERVICE_ROLE_KEY=REPLACE_WITH_YOUR_SERVICE_ROLE_KEY
SUPABASE_ANON_KEY=REPLACE_WITH_YOUR_ANON_KEY
NEXT_PUBLIC_SUPABASE_URL=REPLACE_WITH_YOUR_PROJECT_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=REPLACE_WITH_YOUR_ANON_KEY
JWT_SECRET=REPLACE_WITH_YOUR_GENERATED_SECRET
BACKEND_URL=REPLACE_WITH_YOUR_APP_RUNNER_URL
```

**Important:** `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are the same values as `SUPABASE_URL` and `SUPABASE_ANON_KEY`. The `NEXT_PUBLIC_` prefix is what tells Next.js it is safe to send these to the browser — and the anon key is designed to be public (it respects Row Level Security). The service role key is never prefixed with `NEXT_PUBLIC_` and never leaves the server.

**Verify the file looks right:**
```bash
cat .env.local
```

You should see 7 lines, none of them with `REPLACE_WITH` remaining.

The `.env.local` file is already in `.gitignore` so it will not be committed to the repository.

---

## Step 7 — Test locally

Start the development server:

```bash
cd dashboard
npm run dev
```

Expected output:
```
▲ Next.js 14.x.x
- Local:        http://localhost:3000
- Environments: .env.local

✓ Starting...
✓ Ready in Xs
```

Open `http://localhost:3000` in your browser. You should be automatically redirected to `http://localhost:3000/login`.

**Test the OTP flow:**

1. Enter a phone number that exists in the `staff` table in your Supabase database (in full international format, e.g. `+919876543210`).
2. Click **Send OTP via WhatsApp**.
3. Wait a few seconds. A WhatsApp message should arrive with a 6-digit code like: `Your Sanadige dashboard OTP is: *123456*. Valid for 10 minutes.`
4. Enter the 6-digit code in the dashboard.
5. You should be redirected to `/dashboard` (manager), `/dashboard/catch` (chef), or `/dashboard/bookings` (host) depending on the staff member's role.

**If the WhatsApp message does not arrive:**
- Check that the EC2 backend is running (open `BACKEND_URL/health` in your browser — it should return `{"ok":true,...}`).
- Check server logs: SSH into the EC2 instance and run `pm2 logs sanadige-backend --lines 50`.
- Verify the phone number is in the `staff` table in Supabase (`Table Editor → staff`).
- The OTP endpoint always returns `{ ok: true }` even for unknown numbers (security feature), so lack of a message is the only signal.

**Test each page:**

| URL | Who can access | What to verify |
|---|---|---|
| `/dashboard` | Manager only | 4 KPI cards, bookings chart, 3 widgets |
| `/dashboard/catch` | Manager, Chef | Catch card grid, summary bar |
| `/dashboard/bookings` | Manager, Host | Bookings table |
| `/dashboard/floor` | Manager, Host | SVG floor plan with coloured tables |
| `/dashboard/staff` | Manager only | Staff cards |
| `/dashboard/analytics` | Manager only | 4 charts |

Try accessing `/dashboard/staff` while logged in as a chef — you should be redirected to `/dashboard/catch`.

**Run the tests:**
```bash
npm test
```

Expected:
```
Test Files  1 passed (1)
Tests       2 passed (2)
```

---

## Step 8 — Deploy to Vercel

### 8a — Log in to Vercel

```bash
vercel login
```

Follow the browser prompt to authenticate.

### 8b — Deploy from the dashboard directory

```bash
cd dashboard
vercel
```

Vercel will ask a series of questions:

```
? Set up and deploy "dashboard"? → Yes
? Which scope? → your-account-name
? Link to existing project? → No (creating new)
? What's your project's name? → sanadige-dashboard
? In which directory is your code located? → ./   (press Enter — you are already in dashboard/)
? Want to modify settings? → No
```

After the first deploy completes (usually 1–2 minutes), you will see a preview URL like:
```
✓ Production: https://sanadige-dashboard-xxx.vercel.app
```

Do not worry about the URL yet — you will set the custom domain next. First, add the environment variables.

### 8c — Add environment variables in Vercel

The deployed app needs the same environment variables as your `.env.local`. Set them through the Vercel dashboard:

1. Go to [vercel.com/dashboard](https://vercel.com/dashboard).
2. Click on the **sanadige-dashboard** project.
3. Click **Settings** → **Environment Variables**.
4. Add each variable. For each one, set the **Environment** to **Production**, **Preview**, and **Development**:

| Name | Value | Notes |
|---|---|---|
| `SUPABASE_URL` | your Supabase project URL | |
| `SUPABASE_SERVICE_ROLE_KEY` | your service role key | Mark as **Sensitive** |
| `SUPABASE_ANON_KEY` | your anon key | |
| `NEXT_PUBLIC_SUPABASE_URL` | same as SUPABASE_URL | |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | same as SUPABASE_ANON_KEY | |
| `JWT_SECRET` | your generated secret | Mark as **Sensitive** |
| `BACKEND_URL` | your App Runner URL | |

After adding all 7 variables, you must redeploy for them to take effect:

```bash
vercel --prod
```

Or trigger a redeploy from the Vercel dashboard: **Deployments → ⋯ → Redeploy**.

### 8d — Set the custom domain

1. In the Vercel project, go to **Settings → Domains**.
2. Type `dashboard.sanadige.in` and click **Add**.
3. Vercel will show you a DNS record to add. It will look something like:

```
Type:   CNAME
Name:   dashboard
Value:  cname.vercel-dns.com
```

4. Log in to your DNS provider (wherever you manage `sanadige.in` — Cloudflare, GoDaddy, Namecheap, etc.).
5. Add a CNAME record with the name `dashboard` pointing to `cname.vercel-dns.com`.
6. DNS propagation can take 1–60 minutes. Vercel automatically provisions an SSL certificate once it detects the DNS record.

**Verify:** Open `https://dashboard.sanadige.in/login` in your browser. The login page should load over HTTPS.

---

## Step 9 — Smoke test production

Run through the full flow on the live URL:

1. **Login:** Go to `https://dashboard.sanadige.in/login`. Enter a staff phone number and verify the OTP flow works end-to-end on production.

2. **Role routing:** Log in as a chef and confirm you land on `/catch`. Log in as a host and confirm you land on `/bookings`. Log in as a manager and confirm you land on `/dashboard`.

3. **Mission Control:** Verify the KPI cards show numbers (even 0 is fine if there are no bookings yet). Verify the bookings chart renders. Verify the catch widget, activity feed, and staff widget appear.

4. **Today's Catch:** Click a status badge — it should cycle through Available / Sold Out / Tomorrow. The change should persist if you refresh the page.

5. **Bookings:** Create a test booking via the "+ New Booking" drawer. Verify it appears in the table. Verify the WhatsApp confirmation message is sent to the number you entered.

6. **Floor Map:** Open the floor map. Verify the SVG renders and tables are coloured correctly.

7. **Staff:** Add a test staff member. Verify they receive a WhatsApp welcome message. Delete them afterward.

8. **Analytics:** Open the analytics page. Verify all 4 charts render (they may show empty state if there is no data yet — that is fine).

9. **Sign out:** Click Sign out. Verify you are redirected to `/login` and the session cookie is cleared (attempting to navigate to `/dashboard` should redirect back to `/login`).

---

## Step 10 — Add the backend /auth/send-otp to EC2 CORS (if needed)

If the dashboard and backend are on different domains (which they are — `dashboard.sanadige.in` vs `api.sanadige.in`), and you see CORS errors in the browser console, add the dashboard domain to the backend's allowed origins.

In `backend/src/index.ts`, add a CORS middleware before the routes:

```typescript
import cors from 'cors'

app.use(cors({
  origin: ['https://dashboard.sanadige.in', 'http://localhost:3000'],
  credentials: true,
}))
```

Install the cors package:
```bash
cd backend
npm install cors
npm install -D @types/cors
```

Then redeploy: SSH into the EC2 instance, `git pull`, `npm run build`, `pm2 restart sanadige-backend` (see `backend/SETUP.md` for full redeployment steps).

**Note:** The dashboard calls the backend via **Server Actions** (server-to-server), not from the browser, so CORS is not strictly required for the OTP flow. CORS only matters if you ever call the EC2 backend directly from browser-side JavaScript.

---

## Troubleshooting

### OTP is never received on WhatsApp

1. Open `BACKEND_URL/health` — it should return `{"ok":true}`. If it fails, the backend is down.
2. Check App Runner logs: AWS Console → App Runner → sanadige-backend → **Logs** tab.
3. Verify the phone number is in the `staff` table in Supabase exactly as entered (including the `+` and country code).
4. Check the `staff_otps` table in Supabase — you should see a new row appear after submitting the form. If the row appears but no WhatsApp message arrives, the issue is in the backend's WhatsApp integration.

### "JWT_SECRET not set" error

The `.env.local` file is missing or the variable name is wrong. Double-check:
```bash
cat dashboard/.env.local | grep JWT_SECRET
```

On Vercel production, check the environment variable is set in **Settings → Environment Variables**.

### "Invalid or expired OTP" even with the correct code

The OTP expires after 10 minutes. If more than 10 minutes passed between requesting and entering the code, request a new one.

Also check that the clocks on your EC2 instance and Supabase are in sync (they should be — both use UTC by default).

### Login redirects back to /login immediately after OTP

The JWT cookie is being set but not read. Most commonly caused by:
- `JWT_SECRET` on the production server not matching the one used to sign the token (if you changed it).
- Cookie domain issues if you are testing on `localhost` vs `dashboard.sanadige.in` simultaneously.

### Supabase "relation does not exist" error

The migration in Step 2 was not run. Go back to Step 2 and run `002_dashboard_tables.sql` in the Supabase SQL Editor.

### Build fails on Vercel with "Cannot find module"

Run `npm install` in the `dashboard/` directory locally and commit `package-lock.json` if it changed.

### Charts show nothing

Recharts requires data. If there are no bookings or catch items in the database, the charts will render empty axes. Add some test data via the Bookings and Catch pages and refresh.

---

## Updating the dashboard after code changes

```bash
cd dashboard
vercel --prod
```

Vercel will build and deploy in about 60–90 seconds. The old deployment stays live until the new one is ready (zero-downtime deploy).

For environment variable changes: update them in the Vercel dashboard under Settings → Environment Variables, then trigger a redeploy.

---

## Role and staff management

Staff are managed in two ways:

**Via the dashboard** (Staff page, manager only):
- Add new staff: enter name, WhatsApp phone (full international format, e.g. `+919876543210`), and role.
- Edit roles: click Edit on any staff card.
- The primary manager (set via `MANAGER_PHONE` env var on the backend) cannot be deleted.

**Via WhatsApp** (backend):
- The backend supports adding staff via WhatsApp commands. See `backend/SETUP.md` for details.

**Role permissions:**

| Section | Manager | Chef | Host |
|---|---|---|---|
| Mission Control | ✓ | — | — |
| Today's Catch | ✓ | ✓ | — |
| Bookings | ✓ | — | ✓ |
| Floor Map | ✓ | — | ✓ |
| Staff | ✓ | — | — |
| Analytics | ✓ | — | — |

---

## Session management

Sessions expire after 12 hours. Staff will be redirected to `/login` automatically when their session expires.

There is no "remember me" option by design — this is an internal operations tool used during shifts.

The session cookie is:
- `httpOnly: true` — not accessible to JavaScript
- `secure: true` in production — only sent over HTTPS
- `sameSite: strict` — not sent on cross-site requests

To log out manually, click **Sign out** in the top-right corner of any page. This deletes the `snd_session` cookie server-side and redirects to `/login`.

---

## Database tables used by the dashboard

The dashboard reads and writes to these Supabase tables:

| Table | Read | Write | Purpose |
|---|---|---|---|
| `staff` | ✓ | ✓ | Staff directory, role management |
| `staff_otps` | ✓ | ✓ | OTP verification codes |
| `bookings` | ✓ | ✓ | Reservations |
| `catch_items` | ✓ | ✓ | Fish/seafood catalogue |
| `daily_availability` | ✓ | ✓ | Per-day catch status |
| `activity_log` | ✓ | — | Activity feed (written by backend) |

All reads and writes use the **service role key** on the server. No Supabase queries run in the browser — the anon key is only wired up in `supabase-browser.ts` in anticipation of future Realtime subscriptions.

---

## Extending the dashboard

**Adding Realtime updates (push-based):**

`src/lib/supabase-browser.ts` exports `getBrowserSupabase()` with the anon key. To add live updates to any client component, subscribe to a Supabase channel:

```typescript
'use client'
import { useEffect } from 'react'
import { getBrowserSupabase } from '@/lib/supabase-browser'

// Inside a component:
useEffect(() => {
  const client = getBrowserSupabase()
  const channel = client
    .channel('bookings-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => {
      router.refresh() // re-fetch server component data
    })
    .subscribe()
  return () => { client.removeChannel(channel) }
}, [])
```

**Adding activity log writes:**

Import `getSupabase` in any Server Action and insert into `activity_log`:
```typescript
await getSupabase().from('activity_log').insert({
  event_type: 'booking_new',
  description: `New booking for ${guest_name} (${party_size} guests)`,
  actor_phone: staffPhone,
})
```

**Adding filter UI to the Bookings page:**

The `BookingsPage` server component already reads `searchParams.date`, `searchParams.floor`, and `searchParams.status` from the URL. Add a client-side filter bar that sets these URL params with `router.push` to enable filtering without a full page rebuild.
