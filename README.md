# Sanadige — Reservation System

A complete reservation management platform for Sanadige, New Delhi. Guests book via WhatsApp AI or a public website; staff manage the full dining lifecycle from a real-time dashboard.

---

## What It Does

| Channel | How it works |
|---|---|
| WhatsApp AI | Guest messages the restaurant number → Groq AI assistant checks availability and creates a booking → confirmation sent automatically |
| Website | Guest visits `/book` → selects date, time, party size → fills details → booking held for 15 min pending staff confirmation |
| Phone / Walk-in | Staff create bookings from the dashboard or walk-in drawer |

Once a booking exists, the system handles everything else: 2-hour reminders, day-of arrival messages, check-in, table assignment, post-dining feedback requests, and no-show auto-marking.

---

## Architecture

```
┌─────────────────────────────────────┐    ┌─────────────────────────┐
│          BACKEND (Express)          │    │    DASHBOARD (Next.js)   │
│  Node 20 · TypeScript · PM2/Docker  │    │  Vercel · App Router     │
│                                     │    │                          │
│  /webhooks/whatsapp  ←── Meta API   │    │  /dashboard/bookings     │
│  /bookings/confirm                  │◄───│  /dashboard/floor        │
│  /bookings/whatsapp/send            │    │  /dashboard/guests       │
│                                     │    │  /dashboard/analytics    │
│  Groq AI (llama-3.3-70b)           │    │  /dashboard/marketing    │
│  node-cron reminders                │    │  /dashboard/settings     │
│  Firebase Admin SDK                 │    │  /book  (public)         │
└──────────────┬──────────────────────┘    └────────────┬────────────┘
               │                                        │
               └──────────────┬─────────────────────────┘
                              │
                    ┌─────────▼──────────┐
                    │     Firestore       │
                    │  (Firebase / GCP)   │
                    │                    │
                    │  bookings          │
                    │  guests            │
                    │  staff             │
                    │  tables            │
                    │  service_config    │
                    │  campaigns         │
                    │  conversations     │
                    └────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend runtime | Node.js 20, Express 5, TypeScript |
| Dashboard | Next.js 14 (App Router), React 18, Tailwind CSS |
| Database | Firebase Firestore |
| Auth | Firebase Phone Auth (OTP) → Admin SDK session cookie |
| AI assistant | Groq — `llama-3.3-70b-versatile` |
| Messaging | Meta WhatsApp Cloud API |
| Background jobs | node-cron (reminders, no-show, hold expiry, marketing) |
| Deployment | Backend: AWS EC2 + PM2 + nginx + Certbot (or Docker) |
| Deployment | Dashboard: Vercel |

---

## Repository Structure

```
sanadige/
├── backend/                   # Express API + WhatsApp webhook + cron jobs
│   ├── src/
│   │   ├── index.ts           # Entry point — registers routes, starts cron
│   │   ├── env.ts             # Zod-validated environment schema
│   │   ├── lib/
│   │   │   ├── firebase.ts    # Firebase Admin SDK init
│   │   │   ├── whatsapp.ts    # WhatsApp Cloud API primitives
│   │   │   └── anthropic.ts   # Groq client init (file named anthropic.ts)
│   │   ├── services/
│   │   │   ├── claude.ts      # Groq AI conversation handler + tool calls
│   │   │   ├── reminder.ts    # All cron jobs (reminders, no-show, expiry)
│   │   │   ├── guests.ts      # Guest profile upsert / CRM logic
│   │   │   ├── staff.ts       # Staff lookup, seed from env
│   │   │   └── staff-menu.ts  # WhatsApp staff menu flows
│   │   ├── tools/
│   │   │   ├── check-floor-availability.ts  # Cover cap + turn-time checks
│   │   │   └── create-booking.ts            # Booking creation tool
│   │   ├── routes/
│   │   │   └── bookings.ts    # POST /bookings/confirm, /bookings/whatsapp/send
│   │   └── webhooks/
│   │       ├── whatsapp.ts    # Webhook handler — routes to AI or staff menu
│   │       └── normalise.ts   # Normalises incoming WhatsApp payload
│   ├── Dockerfile
│   └── package.json
│
├── dashboard/                 # Next.js staff dashboard + public booking page
│   ├── src/
│   │   ├── app/
│   │   │   ├── dashboard/
│   │   │   │   ├── page.tsx          # Mission Control (manager home)
│   │   │   │   ├── bookings/         # Booking list + filters + actions
│   │   │   │   ├── floor/            # Floor map + walk-in
│   │   │   │   ├── guests/           # Guest CRM list + [id] detail
│   │   │   │   ├── analytics/        # 30-day metrics
│   │   │   │   ├── marketing/        # Campaign builder + history
│   │   │   │   └── settings/         # Service config per date
│   │   │   ├── book/                 # Public booking widget (no auth)
│   │   │   ├── api/
│   │   │   │   ├── auth/session/     # POST — Firebase idToken → session cookie
│   │   │   │   ├── availability/     # GET — available time slots
│   │   │   │   └── hold/             # POST — create pending booking
│   │   │   └── login/                # Phone OTP login page
│   │   ├── components/
│   │   │   ├── shell/                # Sidebar, Topbar, AutoRefresh
│   │   │   ├── bookings/             # BookingsTable, NewBookingDrawer, WalkInDrawer
│   │   │   ├── floor/                # FloorMap, SeedTablesButton
│   │   │   ├── guests/               # GuestNoteDrawer, GuestTierSelect
│   │   │   ├── marketing/            # CampaignBuilder
│   │   │   ├── home/                 # KpiRow, BookingsChart, UpcomingBookings
│   │   │   └── ui/                   # shadcn/ui primitives
│   │   ├── actions/                  # Next.js Server Actions
│   │   │   ├── bookings.ts
│   │   │   ├── guests.ts
│   │   │   ├── marketing.ts
│   │   │   ├── settings.ts
│   │   │   └── tables.ts
│   │   └── lib/
│   │       ├── firebase-admin.ts     # Server-side Admin SDK
│   │       ├── firebase-client.ts    # Browser-side Client SDK (phone auth)
│   │       ├── auth.ts               # Session cookie verification
│   │       └── backend.ts            # backendPost() helper
│   └── package.json
│
├── firestore.indexes.json     # Composite index definitions — deploy via Firebase CLI
├── firestore.rules            # Security rules — all writes via Admin SDK only
└── SETUP.md                   # Step-by-step setup guide
```

---

## Booking Lifecycle

```
confirmed ──► checked_in ──► seated ──► completed
    │               │
    ▼               ▼
cancelled        no_show (auto at +20 min)
```

- **confirmed** — booking created via any channel; triggers WhatsApp confirmation template immediately
- **checked_in** — host taps Check In at arrival; opens table picker
- **seated** — host assigns a table on the floor map
- **completed** — bill settled; triggers post-dining feedback
- **no_show** — auto-marked 20 min after booking time if still confirmed
- **cancelled** — guest or host cancellation

---

## Staff Roles

| Role | Access |
|---|---|
| **Manager** | Full dashboard — Mission Control, Bookings, Floor Map, Guests, Analytics, Marketing, Settings |
| **Host** | Bookings + Floor Map only |

Login is via phone OTP (Firebase Phone Auth). No passwords.

---

## Automated Flows

| Trigger | What happens |
|---|---|
| Booking confirmed | WhatsApp confirmation template sent to guest |
| 2h before arrival | Reminder template sent (`sanadige_booking_reminder_2h`) |
| 1h before arrival | Day-of template sent (`sanadige_dayof_reminder`) |
| 20 min after booking time (no check-in) | Auto-marked no_show, staff notified |
| ~2h after booking time | Post-dining feedback template sent (`sanadige_post_meal_feedback`) |
| 5:00 PM daily | Staff briefing with tonight's bookings |
| Guest lapsed 90 days | Re-engagement WhatsApp (opt-in only) |
| Birthday in next 7 days | Birthday invite sent |
| 5th / 10th / 20th visit | Milestone message |

> **Note:** The 2h reminder, 1h day-of, and post-meal messages currently use free-form WhatsApp messages
> which only work within Meta's 24-hour service window. To make these work for all guests (including
> website and phone bookings), the three templates below must be submitted and approved in Meta Business
> Manager before the cron jobs are updated to use `sendTemplate()`.

---

## WhatsApp Message Templates

These three templates must be created and approved in
[Meta Business Manager → WhatsApp → Message Templates](https://business.facebook.com/wa/manage/message-templates/)
before the automated reminder cron jobs can reliably reach all guests outside the 24-hour service window.

Once approved, update `backend/src/services/reminder.ts` to replace `sendWhatsAppMessage()` calls
with `sendBookingConfirmationTemplate()`-style calls using the approved template names.

---

### Template 1 — 2-Hour Reminder

| Field | Value |
|---|---|
| **Name** | `sanadige_booking_reminder_2h` |
| **Category** | UTILITY |
| **Language** | English |

**Body:**
```
Your table at Sanadige is in 2 hours, {{1}}!

📅 Tonight · {{2}}
👥 {{3}} guests · {{4}}
🔖 Ref: {{5}}

Need to cancel? Reply CANCEL or call +91 91678 85275.
We look forward to seeing you! 🙏
```

**Variables (in order):**
| # | Field | Example |
|---|---|---|
| `{{1}}` | Guest name | `Rahul` |
| `{{2}}` | Booking time (IST) | `08:00 PM` |
| `{{3}}` | Party size | `4` |
| `{{4}}` | Floor | `Terrace` |
| `{{5}}` | Booking ref | `SND-A1B2C3` |

---

### Template 2 — 1-Hour Day-Of Message

| Field | Value |
|---|---|
| **Name** | `sanadige_dayof_reminder` |
| **Category** | UTILITY |
| **Language** | English |

**Body:**
```
Sanadige — your table is ready for tonight! 🌊

📅 {{1}} · {{2}}
📍 28, Aradhana Enclave, Chanakyapuri, New Delhi

We look forward to welcoming you 🙏
```

**Variables (in order):**
| # | Field | Example |
|---|---|---|
| `{{1}}` | Booking time (IST) | `08:00 PM` |
| `{{2}}` | Floor | `Terrace` |

---

### Template 3 — Post-Meal Feedback

| Field | Value |
|---|---|
| **Name** | `sanadige_post_meal_feedback` |
| **Category** | UTILITY |
| **Language** | English |

**Body:**
```
Thank you for dining with us tonight, {{1}}! 🙏

We hope your meal was everything you hoped for. 🌊

How was your experience at Sanadige?
```

**Buttons (Quick Reply):**
| Button | Reply ID |
|---|---|
| Exceptional | `fb_excellent` |
| Very Good | `fb_good` |
| Leave feedback | `fb_ok` |

**Variables (in order):**
| # | Field | Example |
|---|---|---|
| `{{1}}` | Guest name | `Rahul` |

---

**After all three templates are approved**, update `sendBookingReminders()`, `sendDayOfMessages()`,
and `sendPostMealFeedback()` in `backend/src/services/reminder.ts` to call the approved template
versions instead of the free-form `sendWhatsAppMessage()` / `sendButtons()` functions.

---

## Quick Links

- **Detailed setup**: [SETUP.md](./SETUP.md)
- **Public booking page**: `https://your-dashboard-domain.vercel.app/book`
- **Backend health**: `https://your-backend-domain.com/health`
- **Firestore console**: https://console.firebase.google.com
- **Meta developer portal**: https://developers.facebook.com
- **Groq console**: https://console.groq.com
