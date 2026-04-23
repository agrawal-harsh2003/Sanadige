# QR Digital Menu (PWA) — Design Spec
**Sanadige Delhi · April 24, 2026**

---

## Overview

A guest-facing PWA at `menu.sanadige.in/[tableId]` that lets diners browse the full menu, see live catch availability, ask Claude questions about any dish, and place orders directly to the kitchen — with no app install and no login required.

Staff see incoming orders in real-time on a new `/dashboard/orders` page, and managers/waiters can also take orders manually by table number from the same page.

---

## Architecture

### Repo Structure

```
Sanadige/
├── backend/     # AWS EC2 (git clone, Node.js) → sanadigapi.shopthryv.in  [existing]
├── dashboard/   # Vercel → existing dashboard domain                        [existing]
└── menu/        # Vercel → menu.sanadige.in                                 [NEW]
    ├── src/
    │   └── app/
    │       └── [tableId]/
    │           ├── page.tsx          # server component — initial data fetch
    │           ├── CartProvider.tsx  # React context + useReducer
    │           └── components/
    │               ├── CatchStrip.tsx
    │               ├── MenuTabs.tsx
    │               ├── DishCard.tsx
    │               ├── CartBar.tsx
    │               ├── CartDrawer.tsx
    │               ├── AskPanel.tsx
    │               └── OrderConfirmation.tsx
    ├── public/
    │   ├── manifest.json
    │   └── sw.js
    └── next.config.ts
```

### Data Flow

| Source | Destination | What |
|---|---|---|
| Menu PWA | Supabase (anon key) | Initial fetch of `catch_items`, `daily_availability`, `menu_items` |
| Menu PWA | Supabase Realtime | Live `daily_availability` updates |
| Menu PWA | `POST /orders` | Place order |
| Menu PWA | `POST /menu/ask` | Claude dish chat |
| Dashboard | Supabase Realtime | Live `orders` updates |
| Dashboard | `PATCH /orders/:id/status` | Acknowledge / serve order |
| Dashboard | `POST /orders` | Staff take-order flow |

---

## Menu PWA

### Page: `/[tableId]`

Server component. On request:
1. Fetches all `catch_items` with their today's `daily_availability` row (left join by date)
2. Fetches all `menu_items` where `is_available = true`
3. Renders the full page shell; passes data to client components

URL `tableId` is a plain string (e.g. `T3`, `terrace-1`). It is stored as-is on the order — no validation against a tables table in v1.

### Components

**`CatchStrip`** — client component
- Horizontal scroll strip at the top of the page
- One card per catch item: fish name, local name, origin, recommended preps (comma list), spice dots, availability badge
- Available: teal top border, subtle "LIVE" pulse dot, "+Add" button (same cart controls as `DishCard`)
- Sold out: desaturated, diagonal "Sold Out" watermark overlay, no add button
- Subscribes to Supabase Realtime `daily_availability` on mount; updates availability in-place without re-fetching

**`MenuTabs`**
- Tab bar: Starters · Mains · Breads · Desserts · Drinks
- Each tab renders a grid of `DishCard` components filtered by `category`

**`DishCard`**
- `next/image` dish photo (aspect ratio 4:3, rounded corners)
- Name (large, bold, deep teal), description (2 lines, muted, expandable on tap)
- Price (right-aligned, deep teal)
- Spice dots: 1–5 filled terracotta circles + empty circles for remainder
- Allergen chips: small pill badges
- "+Add" button → becomes `− qty +` inline controls once in cart
- "Ask →" ghost button → opens `AskPanel` scoped to this dish

**`CartBar`** — sticky bottom, hidden when cart empty
- Deep teal background, white text
- Shows: `{n} items · ₹{total}` and "View Order →" button
- Taps open `CartDrawer`

**`CartDrawer`** — vaul drawer from bottom
- Lists each cart item: name, qty controls (`−` / count / `+`), remove button, line total
- Subtotal at bottom
- "Place Order" primary button → triggers order submission
- On loading: button shows spinner, disabled
- On error: inline red error message, cart preserved for retry
- On success: drawer closes, `OrderConfirmation` full-screen overlay appears

**`OrderConfirmation`**
- Full-screen teal wash
- Large animated checkmark
- Order summary (table, items, total)
- "Order more" button → dismisses overlay, cart cleared

**`AskPanel`** — slides up from bottom of dish card
- Dish name as panel title, close button
- Chat thread (user bubbles right, Claude bubbles left)
- Text input + send button at bottom
- Stateless — no history saved; each panel open is a fresh conversation
- Loading spinner while awaiting response
- If panel closes and reopens, conversation resets

### PWA

**`manifest.json`**
```json
{
  "name": "Sanadige",
  "short_name": "Sanadige",
  "display": "standalone",
  "start_url": "/",
  "theme_color": "#1a3a38",
  "background_color": "#f8f3ec"
}
```

**`sw.js`** — install-time cache of the menu shell (HTML, CSS, JS bundles). When offline:
- Cached UI renders normally
- "You're offline — ordering paused" banner shown
- Add-to-cart disabled, Place Order button disabled
- Realtime subscription silently fails (no error shown to guest)

### Environment Variables (Vercel)

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_BACKEND_URL=https://sanadigapi.shopthryv.in
```

---

## Visual Language

### Menu PWA (guest-facing, premium)

- Background: warm sand `oklch(0.97 0.012 75)`
- Card surfaces: pure white
- Primary accent: deep teal `oklch(0.30 0.07 200)`
- Secondary accent: terracotta `oklch(0.55 0.13 45)`
- Dish names: large, confident, deep teal
- Descriptions: muted sand-tone, small
- Prices: deep teal, right-aligned, semi-bold
- Spice dots: filled terracotta / empty muted circles
- Allergen chips: subtle pill badges, no harsh colours
- Catch strip cards: thin teal top border, "LIVE" pulse dot for available items
- Cart bar: deep teal bg, white text — premium checkout feel
- "Ask →": ghost button, terracotta on hover
- Order confirmation: full-screen teal wash, celebratory feel

### Orders Dashboard (staff-facing)

- Matches existing dashboard: `bg-card`, `ring-1 ring-black/5`, `rounded-2xl`
- Pending column header: amber-tinted
- Acknowledged column header: teal-tinted
- Served column header: muted green
- Order cards: table number large bold teal, items tight list, time muted small
- New Order drawer: coastal warmth form style matching booking drawer

---

## Kitchen / Orders Dashboard Page

### Route

`/dashboard/orders` — existing Next.js dashboard app, new page.

**Role access:** `manager`, `chef`, `waiter` (read + status update). `host` does not see this page.

### Layout

- Three swimlane columns: **Pending** · **Acknowledged** · **Served**
- Cards sorted oldest-first within each column
- Each card: table number badge, time placed, item list with qtys and notes, status action button
  - Pending card → "Acknowledge" button (teal)
  - Acknowledged card → "Served" button (green)
  - Served card → no action, muted
- Realtime: `useEffect` subscribes to `INSERT` and `UPDATE` on `orders` via Supabase Realtime; cards appear and move columns without page refresh

### Take Order (manager + waiter only)

- "New Order" button top-right
- Opens a vaul drawer
- Staff selects table from a dropdown of hardcoded table IDs (e.g. T1–T20, Terrace-1–Terrace-8, Private) — defined as a constant in the frontend for v1, no `tables` DB table needed
- Same dish selection UI: tabs, dish cards, qty controls, notes field per item
- "Place Order" submits to `POST /orders` with `table_id` from dropdown
- New card appears instantly in Pending column

---

## Backend Changes

### New Routes

**`backend/src/routes/orders.ts`**

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/orders` | None (public) | Create order from PWA or dashboard |
| `GET` | `/orders` | None | Fetch orders, supports `?date=` and `?status=` query params |
| `PATCH` | `/orders/:id/status` | None | Update order status (`acknowledged` or `served`) |

**`backend/src/routes/menu.ts`**

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/menu/ask` | None (public) | Claude answer scoped to one dish |

Request body:
```json
{
  "dish": {
    "name": "Anjal",
    "description": "Fresh Goan kingfish...",
    "spice_level": 3,
    "allergens": ["Fish"],
    "recommended_preps": ["Tawa Fry", "Konkani Curry"],
    "price": 850
  },
  "message": "Can I get this boneless?"
}
```

Response:
```json
{ "reply": "Yes, boneless is available on request — add a note when ordering." }
```

Uses existing `anthropic` client from `lib/anthropic.ts`. Dish details sent as a cached system prompt block. No streaming in v1.

### CORS

Add `https://menu.sanadige.in` (and `http://localhost:3001` for dev) to the `cors()` allowed origins in `backend/src/index.ts`.

### Schema Migration

New file: `backend/src/db/migrations/003_waiter_role.sql`

```sql
alter table staff drop constraint staff_role_check;
alter table staff add constraint staff_role_check
  check (role in ('chef', 'host', 'manager', 'waiter'));
```

---

## Out of Scope (v1)

- Payment / billing (stays with existing POS)
- Order history per guest
- Guest-facing order status tracking after placement
- Table management (no `tables` table — `table_id` is a freeform string)
- Multi-language menu
