# Sanadige Delhi — Reservation & Ordering Automation
**Design Spec · April 17, 2026**

---

## Overview

A custom AI-powered automation system for Sanadige Delhi (Chanakyapuri), built around three core problems:

1. **Daily catch communication** — chef updates availability once; customers across WhatsApp, Instagram, and the website get live answers
2. **Seating & reservation management** — WhatsApp-native booking with floor preference, SwiftBook sync, and automated reminders
3. **QR digital menu** — PWA with photos, spice levels, allergens, live catch status, and direct-to-kitchen ordering

---

## Existing Tech Stack (Research Findings)

- **Reservations**: SwiftBook.io (official site) + Zomato + EazyDiner + phone calls
- **Delivery**: Zomato + Swiggy (third-party only, no proprietary ordering)
- **Social**: Instagram @sanadige (~8k followers), Facebook
- **Digital menu**: None — static photos on Zomato/MagicPin only
- **WhatsApp**: No Business account currently
- **POS**: Unknown; likely hotel-grade via Goldfinch Hotels

**Gaps addressed by this system**: no WhatsApp automation, no real-time availability, no QR menu, no Instagram DM handling, everything routed through phone calls.

---

## Architecture: Approach A — AI-First Omnichannel Hub

### High-Level Components

```
Customer Channels
  WhatsApp · Instagram DM · Website Chat · QR Menu Scan
          ↓
  Webhook Gateway (Node.js + TypeScript · Railway)
          ↓
  Claude claude-sonnet-4-6 with Tool Use (AI Core)
    ├── get_today_catch()
    ├── check_floor_availability()
    ├── create_booking()
    └── get_menu_item_detail()
          ↓
  ┌─────────────┬──────────────┬─────────────┬─────────────┐
  Catch Service  Booking Service  Menu Service  Dashboard
          ↓
  Supabase (PostgreSQL + Realtime) · SwiftBook API · Vercel
```

### Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js + TypeScript on Railway |
| Database | Supabase (PostgreSQL + Realtime + Auth) |
| AI | Claude claude-sonnet-4-6 (tool use) via Anthropic SDK |
| WhatsApp | Meta WhatsApp Cloud API (direct, free tier) |
| Instagram DM | Meta Graph API |
| Dashboard | Next.js 14 (App Router) on Vercel |
| QR Menu | Next.js PWA on Vercel (`menu.sanadige.in/[tableId]`) |
| Reservations | SwiftBook API (existing, preserved) |
| Hosting | Railway (backend) + Vercel (frontend) |

### Key Design Decisions

- **Single webhook gateway** — WhatsApp, Instagram, and website chat all route to one Node.js service. Claude receives a normalised `{ channel, sender_id, text, timestamp }` object regardless of channel. Instagram DM is handled identically to WhatsApp — same Claude logic, replies sent back via Meta Graph API.
- **Claude with tool use, not hardcoded flows** — Claude decides when to call `get_today_catch()`, `check_floor_availability()`, or `create_booking()` based on customer intent. No brittle keyword matching.
- **Supabase Realtime** — when chef toggles a catch item, all active WhatsApp conversations and every open QR menu update instantly via subscriptions.
- **SwiftBook preserved** — the booking service mirrors every reservation to SwiftBook via their API. Goldfinch hotel operations are unaffected.
- **Prompt caching** — the static menu context (all dish descriptions, allergens, prep notes) is cached in Claude's context window using Anthropic prompt caching, keeping per-query costs low.

---

## Feature 1: Daily Catch Update System

### Chef Update Flow (two options)

**Option A — WhatsApp message to the bot number:**
```
/catch today
✅ Anjal (Kingfish) – Goan
✅ Mud Crab – large, live
✅ Pomfret – Mangalorean
❌ Lobster – not today
❌ Tiger Prawns – back tomorrow
```
Bot parses the message, updates `daily_availability`, confirms "Catch updated ✓".

**Option B — Dashboard toggle:**
Staff flips live toggles on the Next.js dashboard. Each toggle writes to `daily_availability` immediately.

### Data Model

**`catch_items` (static — seeded once)**
```sql
id, name, local_name, origin_region,
description,           -- fed to Claude as context
recommended_preps[],   -- e.g. ["Tawa Fry", "Konkani Curry"]
allergens[],
spice_level (1–5),
image_url
```

**`daily_availability` (live — updated daily)**
```sql
id, catch_item_id, date,
status: available | sold_out | tomorrow,
notes,                 -- e.g. "large ones today"
updated_at, updated_by
```

### Customer Experience

When a customer asks "Is the Anjal in today?" via WhatsApp:
1. Claude calls `get_today_catch()`
2. Tool returns live `daily_availability` joined with `catch_items` descriptions
3. Claude responds with availability + origin + prep suggestions + soft booking prompt

---

## Feature 2: Seating & Reservation System

### WhatsApp Booking Flow

Claude collects in natural conversation:
- Date, time, party size
- Floor preference (Terrace / Floor 2 / Floor 1 / Private)
- Guest name
- Special occasion / dietary notes

On confirmation:
- Booking written to `bookings` table in Supabase
- Booking mirrored to SwiftBook via API
- Confirmation sent with booking ref (format: `SND-XXXX`)
- Reminder job scheduled for 2 hours before

### Automated Reminder

Sent via WhatsApp 2 hours before the booking. Includes:
- Booking summary (time, floor, party size)
- Tonight's available catch items — doubles as a soft pre-arrival upsell
- "Reply cancel if plans change" escape hatch

### Data Model

**`bookings`**
```sql
id, booking_ref,
guest_name, phone, whatsapp_id,
party_size, datetime,
floor: terrace | floor1 | floor2 | private,
special_notes,
status: confirmed | seated | no_show | cancelled,
swiftbook_id,
reminder_sent_at
```

### SwiftBook Integration

> **Note**: SwiftBook API availability must be confirmed with Goldfinch Hotels before build. If no API exists, the booking service writes to Supabase only and a staff member manually enters into SwiftBook — this is the fallback for v1.

```
Customer confirms via WhatsApp
  → Booking Service writes to Supabase
  → Calls SwiftBook API (POST /reservations)
  → Schedules reminder via Node.js cron job
  → Returns booking_ref to customer
```

---

## Feature 3: QR Digital Menu (PWA)

### How It Works

- Each table gets a QR code pointing to `menu.sanadige.in/[tableId]`
- Opens as a PWA in the guest's browser — no app install
- Table ID is encoded in the URL; all orders auto-route to that table's kitchen ticket

### Menu Features

- **Live catch status** — items marked unavailable are greyed out in real-time via Supabase Realtime (same data as WhatsApp bot)
- **Rich dish cards** — photo, description, spice level (1–5 dots), allergen tags, price
- **"Ask about this dish"** — inline Claude chat UI within the PWA (not a WhatsApp redirect), scoped to that dish. Handles "can I get this boneless?", "how spicy is this really?", etc.
- **Direct-to-kitchen ordering** — guest adds to cart → places order → writes to `orders` table → kitchen display and waiter tablet update instantly

### Data Model

**`orders`**
```sql
id, table_id, booking_id (nullable),
items[]: { catch_item_id | menu_item_id, qty, notes },
status: pending | acknowledged | served,
created_at
```

### PWA Tech

- Next.js 14 App Router, deployed on Vercel Edge
- Supabase Realtime subscription for live availability
- `next/image` for optimised dish photos
- PWA manifest + service worker for offline graceful degradation
- QR codes generated per table at setup time

---

## Staff Dashboard

Built in Next.js 14, dark theme, deployed on Vercel.

### Views

- **Overview** — KPI bar (tonight's covers, tables booked, WhatsApp queries, reminders sent, no-show rate), floor map, reservations list, today's catch panel
- **Floor Plan** — colour-coded table grid per floor (seated / booked / free)
- **Bookings** — full reservation list with status, floor tag, special occasion notes, per-row actions
- **Today's Catch** — live toggles, last-updated timestamp, "Broadcast update" button to push WhatsApp notification to opted-in subscribers (guests who have previously messaged the bot and not unsubscribed)
- **Live Orders** — real-time kitchen ticket view from QR menu orders
- **Analytics** — covers over time, no-show rate, popular dishes, peak booking windows

### Auth

Supabase Auth with role-based access:
- `chef` — catch updates only
- `host` — bookings + floor plan
- `manager` — full dashboard + analytics

---

## Error Handling

| Scenario | Handling |
|---|---|
| SwiftBook API down | Booking saved to Supabase, SwiftBook sync retried with exponential backoff. Guest confirmation still sent. |
| Claude API timeout | Fallback message: "Our team will respond shortly" + internal Slack/WhatsApp alert to staff |
| WhatsApp delivery failure | Logged to `message_failures` table, staff alerted on dashboard |
| Chef sends malformed catch update | Claude parses best-effort, asks for confirmation before writing to DB |
| Guest asks out-of-scope question | Claude responds gracefully ("I can help with our menu, availability, and reservations") |

---

## Infrastructure & Costs

### Monthly Operating Cost Estimate

| Service | Cost |
|---|---|
| Railway (Node.js backend) | ~₹800–1,200 |
| Vercel (dashboard + menu PWA) | Free–₹800 |
| Supabase | Free–₹700 |
| Meta WhatsApp Cloud API | ~₹0.40–0.80 per conversation (24h window) |
| Claude API (claude-sonnet-4-6 + caching) | ~₹0.05–0.15 per query |
| **Total at ~500 queries/month** | **~₹4,000–8,000/month** |

### Timeline

| Phase | Duration |
|---|---|
| WhatsApp Cloud API verification + Meta app review | Days 1–5 |
| Backend gateway + Supabase schema + Claude tool use | Days 3–8 |
| Daily catch system + dashboard | Days 6–10 |
| Booking flow + SwiftBook integration | Days 8–12 |
| QR menu PWA | Days 10–14 |
| Testing + staff training | Days 13–14 |

**Total: ~14 days**

---

## Out of Scope (v1)

- Multi-location rollout (Bangalore, Mangalore) — architecture supports it, not in v1
- Payment / deposit collection via WhatsApp
- POS integration (unknown system)
- Swiggy/Zomato menu sync
- Loyalty / CRM features
