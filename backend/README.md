# Sanadige Delhi — Backend

Automation backend for Sanadige Delhi (Chanakyapuri). Handles WhatsApp and Instagram DMs — Claude for customers, a fully button-driven interactive menu for staff.

---

## What this does

**Customers** message on WhatsApp or Instagram DM → Claude answers using live data (catch, menu, bookings).

**Staff** message on WhatsApp → fully button-driven interactive panel, zero free-text input required. No Claude involved.

Three core automations:

1. **Daily catch updates** — Chef selects a fish from a list and taps its status. Customers get live answers instantly.
2. **Reservations** — Host or manager creates a booking step-by-step via buttons. Guest gets a WhatsApp confirmation automatically.
3. **Booking reminders** — Cron job fires a WhatsApp reminder to the guest 2 hours before their booking.

---

## Architecture

```
Incoming WhatsApp message
        ↓
  normalise.ts  →  IncomingMessage { channel, senderId, text, interactiveId? }
        ↓
  whatsapp.ts webhook
        ├── getStaff(senderId)
        │     ├── Staff found  →  staff-menu.ts (interactive button flows)
        │     └── Not staff   →  claude.ts (customer AI assistant)
        │
        ├── staff-menu.ts — state machine (sessions Map)
        │     ├── showMainMenu()         per role: chef / host / manager
        │     ├── Catch flow            list → fish → status buttons → upsert
        │     ├── Bookings flow         sub-menu → view today / create (6 steps)
        │     └── Staff flow            sub-menu → add / remove / view
        │
        └── claude.ts — handleMessage()
              ├── getHistory()           last 20 messages from Supabase
              ├── anthropic.messages.create()  tool use loop
              │     ├── get_today_catch
              │     ├── check_floor_availability
              │     ├── create_booking
              │     └── get_menu_item_detail
              └── saveHistory()
```

**Reminder job**: `node-cron` runs every 10 minutes, finds bookings in the 1h50m–2h10m window, sends WhatsApp reminders, marks `reminder_sent_at`.

---

## Staff WhatsApp Workflow

All staff interactions use WhatsApp Interactive Messages (buttons and lists). Staff never need to type commands. Any unrecognised message shows the main menu. Type `menu`, `hi`, `hello`, or `0` at any time to return to the main menu.

### Main Menu

| Role | Menu type | Options |
|---|---|---|
| Chef | 2 buttons | Update Catch · Help & Guide |
| Host | 2 buttons | Bookings · Help & Guide |
| Manager | List (4 rows) | Today's Catch · Bookings · Staff · Help & Guide |

---

### Today's Catch (Chef & Manager)

Updates fish availability for the day. Can be updated multiple times.

```
Main Menu
  → [Update Catch]
      → List of all fish in catalogue
          (shows current status: ✅ Available / ❌ Sold Out / 🔜 Tomorrow)
          → [Choose fish]
              → 3 buttons: Available · Sold Out · Tomorrow
                  → ✓ Fish Name → status saved to daily_availability
                      → [Update Another] or [Main Menu]
```

Writes to: `daily_availability` (upsert on `catch_item_id + date`)

---

### Bookings (Host & Manager)

#### View Today's Bookings

```
Main Menu
  → [Bookings]
      → [View Today]
          → List of today's bookings:
              🟡 Guest Name × party | time
                 Floor · SND-XXXXXX
              (🟡 confirmed · 🟢 seated · 🔴 cancelled · ⚫ no-show)
              → [New Booking] or [Main Menu]
```

#### Create a New Booking (6 steps, all buttons)

```
Main Menu
  → [Bookings]
      → [New Booking]
          Step 1: Type guest's full name  (text input)
          Step 2: Type guest's WhatsApp number  (text input, with country code)
          Step 3: List — party size
                  Small Party: 1 · 2 · 3 · 4 · 5
                  Large Party: 6 · 7 · 8 · 10 · 12
          Step 4: List — date (rolling 7-day picker)
                  Today · Tomorrow · Mon 22 Apr · Tue 23 Apr · ... (7 rows)
          Step 5: List — time
                  Lunch:  12:00 PM · 12:30 PM · 1:00 PM · 1:30 PM
                  Dinner: 7:00 PM · 7:30 PM · 8:00 PM · 8:30 PM · 9:00 PM · 9:30 PM
          Step 6: List — seating area
                  Terrace (25 seats) · Floor 1 (40) · Floor 2 (35) · Private Room (12)

          → Booking Summary (all details)
              → [Confirm Booking] or [Discard]
                  → ✅ Ref SND-XXXXXX saved to bookings table
                  → Guest receives WhatsApp confirmation (best-effort, 24h window)
                  → [New Booking] or [Main Menu]
```

Only steps 1 and 2 require text input (guest name and phone — cannot be replaced with buttons).

---

### Staff Management (Manager only)

#### View All Staff

```
Main Menu
  → [Staff]
      → [View All Staff]
          → 👔 Manager Name · 91XXXXXXXXXX
            👨‍🍳 Chef Name   · 91XXXXXXXXXX
            🙋 Host Name    · 91XXXXXXXXXX
              → [Staff Menu] or [Main Menu]
```

#### Add Staff

```
Main Menu
  → [Staff]
      → [Add Staff]
          → 3 buttons: Chef · Host · Manager
              → Type new person's full name  (text input)
                  → Type new person's WhatsApp number  (text input)
                      → ✅ Name added as role
                      → Welcome message sent to new staff member automatically
                          (includes role-specific guide + "type menu to start")
                      → [Add Another] or [Staff Menu] or [Main Menu]
```

Welcome messages are sent best-effort. If the new staff member has never messaged the bot, the WhatsApp 24-hour session window won't allow it — they must send `menu` to the bot first.

#### Remove Staff

```
Main Menu
  → [Staff]
      → [Remove Staff]
          → List of all staff (except primary manager)
              → [Choose person]
                  → Confirmation: Remove Name (role)? This cannot be undone.
                      → [Yes, Remove] → ✅ Removed
                      → [Cancel]      → ↩️ Cancelled → Main Menu
```

The primary manager (seeded from `MANAGER_PHONE` env var) cannot be removed.

---

### Help & Guide

Role-specific text guide explaining available actions + dashboard URL. Returns a `[Main Menu]` button.

---

### Global Escape

Any of these words resets the session and shows the main menu from anywhere:

```
menu  hi  hello  home  start  /menu  0
```

Any `[Main Menu]` button in any flow also resets the session.

---

## Architecture — customers (Claude)

```
Customer message
  ↓
claude.ts → handleMessage()
  ├── getHistory()             load last 20 messages from Supabase
  ├── anthropic.messages.create()  with tool definitions + prompt caching
  │     tool use loop:
  │       ├── get_today_catch          → daily_availability JOIN catch_items
  │       ├── check_floor_availability → bookings table ±2h window per floor
  │       ├── create_booking           → INSERT bookings, generate SND-XXXX ref
  │       └── get_menu_item_detail     → menu_items ilike search
  └── saveHistory()            upsert trimmed history to Supabase
```

---

## Tech stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 20, TypeScript 5 |
| Framework | Express 5 |
| AI | Claude claude-sonnet-4-6 via @anthropic-ai/sdk — tool use + prompt caching |
| Database | Supabase (PostgreSQL) |
| Messaging | Meta WhatsApp Cloud API (text + interactive buttons/lists), Meta Graph API (Instagram) |
| Scheduling | node-cron |
| Testing | Vitest |
| Deploy | AWS EC2 t2.micro + PM2 + nginx (ap-south-1) |

---

## Project structure

```
backend/
├── src/
│   ├── index.ts                        # Express app + cron start
│   ├── env.ts                          # Zod-validated env (fail-fast on startup)
│   ├── lib/
│   │   ├── supabase.ts                 # Supabase client singleton
│   │   ├── anthropic.ts                # Anthropic SDK client singleton
│   │   └── whatsapp.ts                 # sendWhatsAppMessage(), sendButtons(), sendList()
│   ├── webhooks/
│   │   ├── whatsapp.ts                 # Routes: staff → staff-menu, else → Claude
│   │   ├── instagram.ts                # GET (hub verification) + POST handler
│   │   └── normalise.ts                # Normalise both platforms to IncomingMessage
│   ├── tools/
│   │   ├── index.ts                    # toolDefinitions array + re-exports
│   │   ├── get-today-catch.ts          # Fetch daily_availability for today
│   │   ├── check-floor-availability.ts # Check bookings in ±2h window per floor
│   │   ├── create-booking.ts           # INSERT booking, generate SND-XXXX ref
│   │   └── get-menu-item-detail.ts     # ilike search on menu_items
│   ├── services/
│   │   ├── claude.ts                   # Customer conversation handler with tool loop
│   │   ├── staff-menu.ts               # Staff interactive menu state machine
│   │   ├── staff.ts                    # getStaff(), staff DB helpers
│   │   └── reminder.ts                 # Cron: send WhatsApp 2h before booking
│   └── db/
│       └── schema.sql                  # Run once in Supabase SQL editor
├── tests/                              # Vitest unit tests
└── Dockerfile                          # Not used for EC2 deploy — kept for reference
```

---

## API endpoints

| Method | Path | Description |
|---|---|---|
| GET | /health | Health check — returns `{ ok: true, ts: "..." }` |
| GET | /webhooks/whatsapp | Meta hub.challenge verification |
| POST | /webhooks/whatsapp | Incoming WhatsApp messages |
| GET | /webhooks/instagram | Meta hub.challenge verification |
| POST | /webhooks/instagram | Incoming Instagram DMs |

---

## Database tables

| Table | Purpose |
|---|---|
| catch_items | Static seafood catalogue (seeded once) |
| daily_availability | Today's catch status — available / sold_out / tomorrow |
| menu_items | Full restaurant menu (non-catch dishes) |
| bookings | Reservations — floor, datetime, status, reminder tracking |
| conversations | Per-sender conversation history (last 20 messages, customers only) |
| staff | Staff members — phone, name, role (chef/host/manager) |
| orders | QR menu orders (Plan 3) |

---

## Staff roles

| Role | WhatsApp access | Dashboard access |
|---|---|---|
| chef | Update Catch | Today's Catch page |
| host | Bookings (view + create) | Bookings + Floor Map |
| manager | All: Catch + Bookings + Staff management | All 6 sections |

The primary manager is seeded from `MANAGER_PHONE` in `.env` on startup. They cannot be removed via the staff panel.

---

## WhatsApp Message Templates

WhatsApp only allows sending messages to numbers that have messaged the bot in the last 24 hours. For staff-created bookings the guest is usually a new contact, so guest confirmations must use an approved **Message Template**.

### booking_confirmation

Used when a host or manager creates a booking via the staff panel. Sends the guest a confirmation with all booking details.

**Setup (one-time):**

1. Go to [business.facebook.com](https://business.facebook.com) → WhatsApp → Message Templates → **Create Template**
2. Fill in:
   - Category: **Utility**
   - Name: `booking_confirmation` ← exact, lowercase with underscores
   - Language: **English**
3. Paste this as the body text:

```
Hello {{1}}! Your table at *Sanadige Delhi* is confirmed.

📅 {{2}}
🕐 {{3}}
👥 {{4}} guests
📍 {{5}}
*Ref:* {{6}}

We look forward to seeing you! For any changes, call us at +91 91678 85275.
```

4. Submit for review. Utility templates are usually approved within minutes to a few hours.

**Variables passed at send time:**

| Position | Value |
|---|---|
| {{1}} | Guest name |
| {{2}} | Date (e.g. Sun, 20 Apr) |
| {{3}} | Time (e.g. 8:00 PM) |
| {{4}} | Party size |
| {{5}} | Seating area (e.g. Terrace) |
| {{6}} | Booking ref (e.g. SND-PAR648) |

If the template send fails (e.g. template not yet approved, or invalid number), the error is logged to PM2 but does not crash the booking flow. Check `pm2 logs sanadige-backend` if guests report not receiving confirmations.

---

## Environment variables

All variables are validated with Zod on startup. The process exits immediately if anything is missing.

| Variable | Required | Description |
|---|---|---|
| SUPABASE_URL | Yes | Supabase project URL |
| SUPABASE_SERVICE_ROLE_KEY | Yes | Service role key (bypasses RLS) |
| ANTHROPIC_API_KEY | Yes | Claude API key |
| WHATSAPP_TOKEN | Yes | Meta WhatsApp Cloud API access token |
| WHATSAPP_PHONE_NUMBER_ID | Yes | Phone number ID from Meta Business |
| WHATSAPP_VERIFY_TOKEN | Yes | Secret string for Meta webhook verification |
| INSTAGRAM_PAGE_ACCESS_TOKEN | Yes | Page access token for the Instagram account |
| INSTAGRAM_VERIFY_TOKEN | Yes | Secret string for Meta webhook verification |
| MANAGER_PHONE | No | Primary manager WhatsApp number (auto-seeded as manager role) |
| SWIFTBOOK_API_KEY | No | Leave empty if SwiftBook API is not available |
| SWIFTBOOK_PROPERTY_ID | No | Leave empty if SwiftBook API is not available |
| PORT | No | Defaults to 3000 — nginx proxies port 80/443 to this |

---

## Running tests

```bash
npm test            # run once
npm run test:watch  # watch mode
```

---

## Plans

This is Plan 1 of 3.

- **Plan 2**: Staff Dashboard (Next.js 14) — catch toggles, floor map, reservation management, staff management UI, analytics
- **Plan 3**: QR Menu PWA (Next.js 14) — menu.sanadige.in/[tableId], live availability, inline Claude Q&A, direct-to-kitchen ordering
