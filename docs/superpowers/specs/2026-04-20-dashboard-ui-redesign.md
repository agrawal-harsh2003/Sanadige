# Sanadige Dashboard UI Redesign — Coastal Warmth

## Goal
Transform the current plain white admin dashboard into a premium, brand-aligned coastal Indian restaurant operations tool. The aesthetic is "coastal warmth": warm sand backgrounds, deep teal, terracotta accents — evoking the Karnataka/Goa coast that Sanadige's food comes from.

## Approach
Option 3 — palette overhaul + targeted component upgrades. Keep all existing logic, routing, and data fetching intact. Change only visual presentation: CSS variables, Tailwind config tokens, and component markup/classes.

---

## Design Tokens

### globals.css — CSS variable changes
Replace all current `oklch` variables with the coastal warmth palette. Keep `oklch` format:

| Variable | Value | Role |
|---|---|---|
| `--background` | `oklch(0.97 0.012 75)` | Warm sand page canvas |
| `--foreground` | `oklch(0.14 0.02 55)` | Warm near-black text |
| `--card` | `oklch(1 0 0)` | Pure white card surface |
| `--card-foreground` | `oklch(0.14 0.02 55)` | Card text |
| `--primary` | `oklch(0.30 0.07 200)` | Deep teal (sidebar, CTAs) |
| `--primary-foreground` | `oklch(0.97 0.01 75)` | Cream text on teal |
| `--accent` | `oklch(0.55 0.13 45)` | Terracotta / copper accent |
| `--accent-foreground` | `oklch(1 0 0)` | White on terracotta |
| `--muted` | `oklch(0.93 0.008 75)` | Warm light gray |
| `--muted-foreground` | `oklch(0.50 0.02 60)` | Warm mid-gray text |
| `--border` | `oklch(0.88 0.010 75)` | Warm light border |
| `--input` | `oklch(0.93 0.008 75)` | Input background |
| `--ring` | `oklch(0.30 0.07 200)` | Focus ring (teal) |
| `--destructive` | `oklch(0.55 0.18 25)` | Warm coral red |
| `--sidebar` | `oklch(0.22 0.06 200)` | Deep teal sidebar |
| `--sidebar-foreground` | `oklch(0.94 0.01 75)` | Cream sidebar text |
| `--sidebar-accent` | `oklch(0.28 0.08 200)` | Active nav hover teal |
| `--sidebar-accent-foreground` | `oklch(0.97 0.01 75)` | Active nav text |

### tailwind.config.ts — add tokens
Already fixed (hsl → var). Add these additional tokens:
- `sidebar: 'var(--sidebar)'`
- `sidebar-foreground: 'var(--sidebar-foreground)'`
- `sidebar-accent: 'var(--sidebar-accent)'`
- `accent: 'var(--accent)'`
- `accent-foreground: 'var(--accent-foreground)'`

---

## Component Upgrades

### 1. Sidebar (`src/components/shell/Sidebar.tsx`)

**Brand block:**
- Background: `bg-sidebar` (deep teal)
- "Sanadige" wordmark in `text-sidebar-foreground font-bold text-lg`
- Tagline beneath: `"Where the coast meets Delhi"` in `text-xs text-sidebar-foreground/60`
- No more square "S" icon — just the wordmark

**Nav items:**
- Default: `text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent`
- Active: `bg-sidebar-accent text-sidebar-foreground font-semibold` + `border-l-2 border-accent`
- Icons: replace emoji strings with lucide-react icons (Fish, Calendar, Map, Users, BarChart3, LayoutDashboard)
- Bottom section: staff name + role pill (`manager` = terracotta, `host` = teal-300, `chef` = amber)

**Lucide icons mapping:**
- Mission Control → `LayoutDashboard`
- Today's Catch → `Fish`
- Bookings → `CalendarDays`
- Floor Map → `Map`
- Staff → `Users`
- Analytics → `BarChart3`

### 2. Login Page (`src/app/login/page.tsx`)

**Layout:** Full-height two-column split (hidden on mobile, stacked on mobile):
- Left panel (hidden md:block, w-1/2): `bg-sidebar` deep teal with centered branding — large "Sanadige" in cream, tagline, subtle wave SVG decoration at bottom
- Right panel (w-full md:w-1/2): `bg-background` warm sand, centered login card

**Login card:**
- White card, `rounded-2xl shadow-lg ring-1 ring-black/5`, max-w-sm
- No more black "S" square — teal fish icon (lucide `Fish`) in terracotta circle
- Title: `text-2xl font-bold` warm near-black
- OTP input: larger tracking, centered, `text-xl`
- CTA button: `bg-primary hover:bg-primary/90 text-primary-foreground` (teal)

**Mobile:** Single column, warm sand background, card centered

### 3. KPI Cards (`src/components/home/KpiRow.tsx`)

Each card:
- `bg-card shadow-sm ring-1 ring-black/5 rounded-2xl p-5`
- Label: `text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground mb-1`
- Value: `text-4xl font-bold text-foreground` (up from text-3xl)
- Sub-label: `text-xs text-muted-foreground mt-1`
- Small colored icon/emoji top-right per metric:
  - Today's Bookings: `CalendarDays` icon in teal
  - Available Seats: `Users` icon in teal
  - Catch Live: `Fish` icon in terracotta
  - Revenue Today: `IndianRupee` icon in amber

### 4. Catch Cards (`src/components/catch/CatchCard.tsx`)

- Left accent border 4px, color-matched to status (green/red/amber) — already exists, keep
- Card: `bg-card shadow-sm ring-1 ring-black/5 rounded-2xl p-5` (increase padding, add shadow)
- Fish name: `text-base font-semibold text-foreground`
- Origin region: `text-xs text-muted-foreground italic` with a small map-pin icon
- Status badge: pill with more padding `px-3 py-1`, font-semibold, clickable — keep cycle logic
- Prep tags: `bg-muted text-muted-foreground text-xs rounded-full px-2.5 py-0.5` (warmer than plain bg-background)
- Notes textarea: warm input bg, teal focus ring

**Status colors (refined):**
- available: `border-l-emerald-500`, badge: `bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200`
- sold_out: `border-l-rose-500`, badge: `bg-rose-50 text-rose-700 ring-1 ring-rose-200`
- tomorrow: `border-l-amber-500`, badge: `bg-amber-50 text-amber-800 ring-1 ring-amber-200`

### 5. Bookings Table (`src/components/bookings/BookingsTable.tsx`)

**Floor labels** — fix raw DB values:
```
const FLOOR_LABEL: Record<string, string> = {
  terrace: 'Terrace', floor1: 'Floor 1', floor2: 'Floor 2', private: 'Private'
}
```

**Floor badge colors** (updated to brand palette):
- terrace: `bg-amber-50 text-amber-800 ring-1 ring-amber-200`
- floor1: `bg-teal-50 text-teal-800 ring-1 ring-teal-200`
- floor2: `bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200`
- private: `bg-rose-50 text-rose-800 ring-1 ring-rose-200`

**Status badge colors:**
- confirmed: `bg-teal-50 text-teal-800 ring-1 ring-teal-200`
- seated: `bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200`
- no_show: `bg-muted text-muted-foreground`
- cancelled: `bg-rose-50 text-rose-700`

**Status labels** — capitalize: "Confirmed", "Seated", "No Show", "Cancelled"

**Table structure:**
- Header: `bg-muted/50 border-b border-border`
- Rows: hover `bg-muted/30`, alternating subtle warmth
- Time column: bold, `text-foreground`
- Expanded row: `bg-muted/20` with teal WhatsApp link

### 6. Floor Map (`src/components/floor/FloorMap.tsx`)

**SVG improvements:**
- Section labels: teal color (`#1C4A5A`) instead of gray
- Status colors updated:
  - available: `#10b981` (emerald)
  - booked: `#f59e0b` (amber)
  - seated: `#f43f5e` (rose)
- Table fill opacity: `0.25` (slightly more visible)
- Stroke width: `1.5`
- Add subtle background rect per section (very light teal tint `#f0f9ff` at 40% opacity) to define zones

### 7. Staff Card (`src/components/staff/StaffCard.tsx`)

**Avatar:**
- manager: terracotta circle `bg-accent`
- host: teal circle `bg-primary`
- chef: amber circle `bg-amber-500`

**Role badge:**
- manager: `bg-accent/10 text-accent ring-1 ring-accent/20` text "Manager"
- host: `bg-primary/10 text-primary ring-1 ring-primary/20` text "Host"
- chef: `bg-amber-50 text-amber-800 ring-1 ring-amber-200` text "Chef"

**Card:** `bg-card shadow-sm ring-1 ring-black/5 rounded-2xl p-5`

**Primary manager card:** left border terracotta `border-l-4 border-accent` instead of green

### 8. Shell — Topbar (`src/components/shell/Topbar.tsx`)

- Background: `bg-card border-b border-border shadow-sm`
- Role badge: styled with brand colors
- "Sign out" as ghost button with teal text

### 9. Home Widgets (ActivityFeed, CatchWidget, StaffWidget, UpcomingBookings, BookingsChart)

All cards: `bg-card shadow-sm ring-1 ring-black/5 rounded-2xl p-5`

**BookingsChart:** Bar fill color change to `#1C4A5A` (teal) for week bars, terracotta `#C4633A` highlight for today's bar.

**CatchWidget:** Status dots updated to emerald/rose/amber. Empty state with fish icon.

**UpcomingBookings:** Time in bold teal, guest name prominent, floor as colored pill.

**ActivityFeed:** Event icons keep emoji but background dot updated per event type.

**StaffWidget:** Avatar circles with role colors (terracotta for manager, teal for host, amber for chef).

---

## Files Changed

| File | Change type |
|---|---|
| `src/app/globals.css` | Replace CSS variables with coastal palette |
| `tailwind.config.ts` | Add sidebar, accent tokens |
| `src/components/shell/Sidebar.tsx` | Full redesign: teal bg, lucide icons, wordmark |
| `src/app/login/page.tsx` | Split layout, teal left panel, branded card |
| `src/components/home/KpiRow.tsx` | Larger numbers, icons, shadow cards |
| `src/components/catch/CatchCard.tsx` | Shadow, refined badge colors, warmer prep tags |
| `src/components/bookings/BookingsTable.tsx` | Floor labels, brand badge colors, capitalize status |
| `src/components/floor/FloorMap.tsx` | Teal section labels, updated status colors, zone backgrounds |
| `src/components/staff/StaffCard.tsx` | Role-colored avatars, brand badges, shadow card |
| `src/components/shell/Topbar.tsx` | Card bg, brand role badge |
| `src/components/home/ActivityFeed.tsx` | Shadow card |
| `src/components/home/BookingsChart.tsx` | Teal bars, terracotta today highlight |
| `src/components/home/CatchWidget.tsx` | Updated status dot colors |
| `src/components/home/UpcomingBookings.tsx` | Teal time, floor pill |
| `src/components/home/StaffWidget.tsx` | Role-colored avatars |

## Dependencies to add
- `lucide-react` — for clean SVG icons (Fish, CalendarDays, Map, Users, BarChart3, LayoutDashboard, IndianRupee, MapPin)

Check if already installed: `npm list lucide-react`

---

## What Does NOT Change
- All server actions, data fetching, routing
- Authentication flow logic
- WhatsApp integration
- FloorMap table definitions and state logic
- Booking/catch CRUD operations
- Analytics chart data (recharts library calls stay identical)
