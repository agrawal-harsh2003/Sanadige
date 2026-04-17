# Sanadige Delhi — Backend

AI-powered automation backend for Sanadige Delhi (Chanakyapuri). Handles WhatsApp and Instagram DM messages through Claude claude-sonnet-4-6, manages daily seafood availability, reservations, and automated reminders.

---

## What this does

**Customers message on WhatsApp or Instagram DM** → backend normalises the message → Claude decides which tool to call → replies with live data.

Three core automations:

1. **Daily catch updates** — Chef sends a `/catch` command on WhatsApp (or toggles from the dashboard). All customer queries about availability are answered in real-time using that data.

2. **Reservations** — Claude collects date, time, party size, floor preference, and guest name through natural conversation, then writes to Supabase and (optionally) syncs to SwiftBook. A WhatsApp reminder fires automatically 2 hours before the booking.

3. **Menu Q&A** — Claude answers questions about dishes, allergens, spice levels, and pricing using the `get_menu_item_detail` tool.

---

## Architecture

```
Customer (WhatsApp / Instagram DM)
        ↓
  Webhook Gateway  (/webhooks/whatsapp, /webhooks/instagram)
        ↓
  normalise.ts  →  IncomingMessage { channel, senderId, text }
        ↓
  claude.ts  →  handleMessage()
    ├── getHistory()        — load last 20 messages from Supabase
    ├── anthropic.messages.create()  — with prompt caching + tool defs
    │     └── tool use loop
    │           ├── get_today_catch       → daily_availability JOIN catch_items
    │           ├── check_floor_availability  → bookings table ±2h window
    │           ├── create_booking        → INSERT bookings
    │           └── get_menu_item_detail  → menu_items ilike search
    └── saveHistory()       — upsert trimmed history to Supabase
        ↓
  sendWhatsAppMessage() / Instagram Graph API
        ↓
  Customer receives reply
```

**Reminder job**: `node-cron` runs every 10 minutes, finds bookings in the 1h50m–2h window, sends WhatsApp reminders, marks `reminder_sent_at`.

---

## Tech stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 20, TypeScript 5 |
| Framework | Express 5 |
| AI | Claude claude-sonnet-4-6 via @anthropic-ai/sdk — tool use + prompt caching |
| Database | Supabase (PostgreSQL + Realtime) |
| Messaging | Meta WhatsApp Cloud API, Meta Graph API (Instagram) |
| Scheduling | node-cron |
| Testing | Vitest |
| Deploy | Railway (NIXPACKS) |

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
│   │   └── whatsapp.ts                 # sendWhatsAppMessage()
│   ├── webhooks/
│   │   ├── whatsapp.ts                 # GET (hub verification) + POST handler
│   │   ├── instagram.ts                # GET (hub verification) + POST handler
│   │   └── normalise.ts                # Normalise both platforms to IncomingMessage
│   ├── tools/
│   │   ├── index.ts                    # toolDefinitions array + re-exports
│   │   ├── get-today-catch.ts          # Fetch daily_availability for today
│   │   ├── check-floor-availability.ts # Check bookings in ±2h window per floor
│   │   ├── create-booking.ts           # INSERT booking, generate SND-XXXX ref
│   │   └── get-menu-item-detail.ts     # ilike search on menu_items
│   ├── services/
│   │   ├── claude.ts                   # Full conversation handler with tool loop
│   │   ├── catch.ts                    # Parse /catch command, upsert daily_availability
│   │   └── reminder.ts                 # Cron: send WhatsApp 2h before booking
│   └── db/
│       └── schema.sql                  # Run once in Supabase SQL editor
└── tests/                              # Vitest unit tests (21 passing)
```

---

## API endpoints

| Method | Path | Description |
|---|---|---|
| GET | /health | Health check — returns { ok: true, ts: "..." } |
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
| conversations | Per-sender conversation history (last 20 messages) |
| orders | QR menu orders (Plan 3) |

---

## Chef catch update format

Send this to the bot's WhatsApp number:

```
/catch today
✅ Anjal – Goan, large pieces today
✅ Mud Crab – live, limited quantity
❌ Lobster – not today
❌ Tiger Prawns – back tomorrow
```

- ✅ sets status: available
- ❌ sets status: sold_out
- Lines with "tomorrow" set status: tomorrow

Bot replies: ✓ Catch updated — 4 items set for today.

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
| SWIFTBOOK_API_KEY | No | Leave empty if SwiftBook API is not available |
| SWIFTBOOK_PROPERTY_ID | No | Leave empty if SwiftBook API is not available |
| PORT | No | Defaults to 3000 |

---

## Running tests

```bash
npm test            # run once
npm run test:watch  # watch mode
```

21 tests, no real network calls (all mocked with Vitest).

---

## Plans

This is Plan 1 of 3.

- **Plan 2**: Staff Dashboard (Next.js 14) — catch toggles, floor map, reservation management, analytics
- **Plan 3**: QR Menu PWA (Next.js 14) — menu.sanadige.in/[tableId], live availability, inline Claude Q&A, direct-to-kitchen ordering
