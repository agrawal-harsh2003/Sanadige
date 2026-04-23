# QR Menu — Plan 2: Menu PWA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a guest-facing Next.js PWA at `menu/` that lets diners browse the full menu, see live catch availability via Supabase Realtime, add items to a cart, ask Claude questions about dishes, and place orders to the kitchen.

**Architecture:** A new standalone Next.js 16 app at `Sanadige/menu/`. A server component at `app/[tableId]/page.tsx` fetches initial data; client components handle cart state, Realtime subscriptions, the ask panel, and order submission. The cart lives in React context + `useReducer` — no persistence needed. All backend writes go to `sanadigapi.shopthryv.in`.

**Tech Stack:** Next.js 16, TypeScript, Tailwind CSS v4, `@supabase/supabase-js`, `vaul`, `lucide-react`, `date-fns`, `clsx`, `tailwind-merge`.

**Prerequisites:** Plan 1 (backend) must be deployed — `POST /orders` and `POST /menu/ask` must be live.

**Working directory for all commands:** `menu/` (after scaffolding)

---

## File Map

| Action | File |
|---|---|
| Create | `menu/package.json` |
| Create | `menu/next.config.ts` |
| Create | `menu/tsconfig.json` |
| Create | `menu/tailwind.config.ts` |
| Create | `menu/src/app/globals.css` |
| Create | `menu/src/app/layout.tsx` |
| Create | `menu/src/app/[tableId]/page.tsx` |
| Create | `menu/src/app/[tableId]/MenuShell.tsx` |
| Create | `menu/src/app/[tableId]/components/CatchStrip.tsx` |
| Create | `menu/src/app/[tableId]/components/MenuTabs.tsx` |
| Create | `menu/src/app/[tableId]/components/DishCard.tsx` |
| Create | `menu/src/app/[tableId]/components/CartBar.tsx` |
| Create | `menu/src/app/[tableId]/components/CartDrawer.tsx` |
| Create | `menu/src/app/[tableId]/components/AskPanel.tsx` |
| Create | `menu/src/app/[tableId]/components/OrderConfirmation.tsx` |
| Create | `menu/src/lib/supabase.ts` |
| Create | `menu/src/lib/backend.ts` |
| Create | `menu/src/lib/cart.tsx` |
| Create | `menu/src/lib/cn.ts` |
| Create | `menu/public/manifest.json` |
| Create | `menu/public/sw.js` |

---

### Task 1: Scaffold the menu app

**Files:** `menu/package.json`, `menu/next.config.ts`, `menu/tsconfig.json`, `menu/tailwind.config.ts`

- [ ] **Step 1: Create the directory and package.json**

From `Sanadige/` root:

```bash
mkdir menu && cd menu
```

Create `menu/package.json`:

```json
{
  "name": "sanadige-menu",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev --port 3001",
    "build": "next build",
    "start": "next start --port 3001"
  },
  "dependencies": {
    "clsx": "^2.1.1",
    "date-fns": "^4.1.0",
    "lucide-react": "^0.511.0",
    "next": "15.3.1",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "tailwind-merge": "^3.3.0",
    "vaul": "^1.1.2",
    "@supabase/supabase-js": "^2.103.3"
  },
  "devDependencies": {
    "@types/node": "^22",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "tailwindcss": "^4",
    "typescript": "^5"
  }
}
```

- [ ] **Step 2: Install dependencies**

```bash
npm install
```

Expected: `node_modules/` created, no errors

- [ ] **Step 3: Create `menu/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 4: Create `menu/next.config.ts`**

```typescript
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'dbgxjcjynuqibztdjtub.supabase.co',
      },
    ],
  },
}

export default nextConfig
```

- [ ] **Step 5: Create `menu/tailwind.config.ts`**

```typescript
import type { Config } from 'tailwindcss'

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        primary: 'var(--primary)',
        'primary-foreground': 'var(--primary-foreground)',
        accent: 'var(--accent)',
        'accent-foreground': 'var(--accent-foreground)',
        card: 'var(--card)',
        muted: 'var(--muted)',
        'muted-foreground': 'var(--muted-foreground)',
        border: 'var(--border)',
      },
      animation: {
        'pulse-slow': 'pulse 2.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
} satisfies Config
```

- [ ] **Step 6: Commit**

```bash
cd .. && git add menu/package.json menu/next.config.ts menu/tsconfig.json menu/tailwind.config.ts menu/package-lock.json
git commit -m "feat(menu): scaffold Next.js app"
```

---

### Task 2: Global styles and utility functions

**Files:** `menu/src/app/globals.css`, `menu/src/lib/cn.ts`

- [ ] **Step 1: Create `menu/src/lib/cn.ts`**

```typescript
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

- [ ] **Step 2: Create `menu/src/app/globals.css`**

```css
@import "tailwindcss";

:root {
  --background: oklch(0.97 0.012 75);
  --foreground: oklch(0.15 0.03 200);
  --primary: oklch(0.30 0.07 200);
  --primary-foreground: oklch(0.97 0.012 75);
  --accent: oklch(0.55 0.13 45);
  --accent-foreground: oklch(0.97 0.012 75);
  --card: oklch(1 0 0);
  --muted: oklch(0.93 0.008 75);
  --muted-foreground: oklch(0.55 0.02 75);
  --border: oklch(0.88 0.01 75);
}

* {
  box-sizing: border-box;
  padding: 0;
  margin: 0;
}

html, body {
  max-width: 100vw;
  overflow-x: hidden;
  background-color: var(--background);
  color: var(--foreground);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  -webkit-font-smoothing: antialiased;
}

/* Hide scrollbar on the catch strip */
.scrollbar-hide::-webkit-scrollbar { display: none; }
.scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
```

- [ ] **Step 3: Commit**

```bash
git add menu/src/app/globals.css menu/src/lib/cn.ts
git commit -m "feat(menu): global styles and cn utility"
```

---

### Task 3: Supabase client and backend client

**Files:** `menu/src/lib/supabase.ts`, `menu/src/lib/backend.ts`

- [ ] **Step 1: Create `menu/src/lib/supabase.ts`**

```typescript
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
```

- [ ] **Step 2: Create `menu/src/lib/backend.ts`**

```typescript
const BASE = process.env.NEXT_PUBLIC_BACKEND_URL!.replace(/\/$/, '')

export async function backendPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string }
    throw new Error(err.error ?? `Request failed: ${res.status}`)
  }
  return res.json() as Promise<T>
}
```

- [ ] **Step 3: Create `menu/.env.local`**

```
NEXT_PUBLIC_SUPABASE_URL=https://dbgxjcjynuqibztdjtub.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<paste anon key from Supabase dashboard>
NEXT_PUBLIC_BACKEND_URL=https://sanadigapi.shopthryv.in
```

For local dev, also add:
```
NEXT_PUBLIC_BACKEND_URL=http://localhost:3000
```

- [ ] **Step 4: Commit**

```bash
git add menu/src/lib/supabase.ts menu/src/lib/backend.ts
git commit -m "feat(menu): Supabase client and backend client"
```

---

### Task 4: Enable Supabase RLS for anon reads and writes

The menu PWA uses the Supabase **anon** key. Row-Level Security must allow anon users to read menu data and insert orders.

- [ ] **Step 1: Run in Supabase SQL editor**

```sql
-- Allow anon to read catch_items
alter table catch_items enable row level security;
create policy "anon read catch_items" on catch_items for select to anon using (true);

-- Allow anon to read daily_availability
alter table daily_availability enable row level security;
create policy "anon read daily_availability" on daily_availability for select to anon using (true);

-- Allow anon to read menu_items
alter table menu_items enable row level security;
create policy "anon read menu_items" on menu_items for select to anon using (true);

-- Allow anon to insert orders
alter table orders enable row level security;
create policy "anon insert orders" on orders for insert to anon with check (true);

-- Allow anon to read orders (needed for Realtime)
create policy "anon read orders" on orders for select to anon using (true);
```

- [ ] **Step 2: Enable Realtime for relevant tables**

In Supabase dashboard → Database → Replication, add `daily_availability` and `orders` to the `supabase_realtime` publication.

Or via SQL:
```sql
alter publication supabase_realtime add table daily_availability;
alter publication supabase_realtime add table orders;
```

---

### Task 5: Cart context

**Files:** `menu/src/lib/cart.tsx`

- [ ] **Step 1: Create `menu/src/lib/cart.tsx`**

```typescript
'use client'
import React, { createContext, useContext, useReducer } from 'react'

export interface CartItem {
  id: string
  itemType: 'catch' | 'menu'
  name: string
  price: number
  qty: number
  notes?: string
}

interface CartState {
  items: CartItem[]
}

type CartAction =
  | { type: 'ADD'; item: Omit<CartItem, 'qty'> }
  | { type: 'REMOVE'; id: string }
  | { type: 'UPDATE_QTY'; id: string; qty: number }
  | { type: 'SET_NOTES'; id: string; notes: string }
  | { type: 'CLEAR' }

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'ADD': {
      const existing = state.items.find(i => i.id === action.item.id)
      if (existing) {
        return { items: state.items.map(i => i.id === action.item.id ? { ...i, qty: i.qty + 1 } : i) }
      }
      return { items: [...state.items, { ...action.item, qty: 1 }] }
    }
    case 'REMOVE':
      return { items: state.items.filter(i => i.id !== action.id) }
    case 'UPDATE_QTY': {
      if (action.qty <= 0) return { items: state.items.filter(i => i.id !== action.id) }
      return { items: state.items.map(i => i.id === action.id ? { ...i, qty: action.qty } : i) }
    }
    case 'SET_NOTES':
      return { items: state.items.map(i => i.id === action.id ? { ...i, notes: action.notes } : i) }
    case 'CLEAR':
      return { items: [] }
    default:
      return state
  }
}

interface CartContextValue {
  items: CartItem[]
  total: number
  itemCount: number
  dispatch: React.Dispatch<CartAction>
}

const CartContext = createContext<CartContextValue | null>(null)

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, { items: [] })
  const total = state.items.reduce((sum, i) => sum + i.price * i.qty, 0)
  const itemCount = state.items.reduce((sum, i) => sum + i.qty, 0)
  return (
    <CartContext.Provider value={{ items: state.items, total, itemCount, dispatch }}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used inside CartProvider')
  return ctx
}
```

- [ ] **Step 2: Commit**

```bash
git add menu/src/lib/cart.tsx
git commit -m "feat(menu): cart context with useReducer"
```

---

### Task 6: Root layout with PWA meta

**Files:** `menu/src/app/layout.tsx`

- [ ] **Step 1: Create `menu/src/app/layout.tsx`**

```typescript
import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Sanadige — Menu',
  description: 'Fresh coastal seafood from Goa, Kerala & Karnataka',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Sanadige',
  },
}

export const viewport: Viewport = {
  themeColor: '#1a3a38',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body>
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                  navigator.serviceWorker.register('/sw.js').catch(() => {})
                })
              }
            `,
          }}
        />
      </body>
    </html>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add menu/src/app/layout.tsx
git commit -m "feat(menu): root layout with PWA meta and SW registration"
```

---

### Task 7: Server page — data fetching

**Files:** `menu/src/app/[tableId]/page.tsx`

- [ ] **Step 1: Create `menu/src/app/[tableId]/page.tsx`**

```typescript
import { createClient } from '@supabase/supabase-js'
import { MenuShell } from './MenuShell'

export interface CatchWithAvailability {
  id: string
  name: string
  local_name: string | null
  origin_region: string
  description: string
  recommended_preps: string[]
  allergens: string[]
  spice_level: number
  image_url: string | null
  status: 'available' | 'sold_out' | 'tomorrow' | null
  notes: string | null
}

export interface MenuItem {
  id: string
  name: string
  category: string
  description: string
  price: number
  allergens: string[]
  spice_level: number | null
  image_url: string | null
  is_available: boolean
}

function getServerSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export default async function MenuPage({ params }: { params: Promise<{ tableId: string }> }) {
  const { tableId } = await params
  const supabase = getServerSupabase()
  const today = new Date().toISOString().split('T')[0]

  const [catchRes, menuRes] = await Promise.all([
    supabase
      .from('catch_items')
      .select(`
        id, name, local_name, origin_region, description,
        recommended_preps, allergens, spice_level, image_url,
        daily_availability!left(status, notes)
      `)
      .filter('daily_availability.date', 'eq', today),
    supabase
      .from('menu_items')
      .select('id, name, category, description, price, allergens, spice_level, image_url, is_available')
      .eq('is_available', true)
      .order('category'),
  ])

  const catchItems: CatchWithAvailability[] = (catchRes.data ?? []).map((r: Record<string, unknown>) => {
    const avail = Array.isArray(r.daily_availability)
      ? (r.daily_availability as Record<string, unknown>[])[0]
      : null
    return {
      id: r.id as string,
      name: r.name as string,
      local_name: r.local_name as string | null,
      origin_region: r.origin_region as string,
      description: r.description as string,
      recommended_preps: r.recommended_preps as string[],
      allergens: r.allergens as string[],
      spice_level: r.spice_level as number,
      image_url: r.image_url as string | null,
      status: avail ? (avail.status as 'available' | 'sold_out' | 'tomorrow') : null,
      notes: avail ? (avail.notes as string | null) : null,
    }
  })

  const menuItems: MenuItem[] = (menuRes.data ?? []) as MenuItem[]

  return <MenuShell tableId={tableId} catchItems={catchItems} menuItems={menuItems} />
}
```

- [ ] **Step 2: Commit**

```bash
git add menu/src/app/[tableId]/page.tsx
git commit -m "feat(menu): server page with catch + menu data fetch"
```

---

### Task 8: MenuShell — client wrapper

**Files:** `menu/src/app/[tableId]/MenuShell.tsx`

- [ ] **Step 1: Create `menu/src/app/[tableId]/MenuShell.tsx`**

```typescript
'use client'
import { useState } from 'react'
import { CartProvider } from '@/lib/cart'
import { CatchStrip } from './components/CatchStrip'
import { MenuTabs } from './components/MenuTabs'
import { CartBar } from './components/CartBar'
import { CartDrawer } from './components/CartDrawer'
import { OrderConfirmation } from './components/OrderConfirmation'
import type { CatchWithAvailability, MenuItem } from './page'

interface Props {
  tableId: string
  catchItems: CatchWithAvailability[]
  menuItems: MenuItem[]
}

export function MenuShell({ tableId, catchItems, menuItems }: Props) {
  const [cartOpen, setCartOpen] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [lastOrderId, setLastOrderId] = useState<string | null>(null)

  function handleOrderSuccess(orderId: string) {
    setCartOpen(false)
    setLastOrderId(orderId)
    setConfirmed(true)
  }

  return (
    <CartProvider>
      {/* Header */}
      <header className="sticky top-0 z-40 bg-primary text-primary-foreground px-4 py-3 flex items-center justify-between shadow-md">
        <div>
          <p className="font-bold text-lg tracking-tight">Sanadige</p>
          <p className="text-[11px] text-primary-foreground/60 -mt-0.5">Where the coast meets Delhi</p>
        </div>
        <div className="bg-primary-foreground/10 px-3 py-1.5 rounded-full">
          <p className="text-xs font-semibold text-primary-foreground">Table {tableId}</p>
        </div>
      </header>

      <main className="pb-28">
        <CatchStrip initialItems={catchItems} tableId={tableId} />
        <MenuTabs menuItems={menuItems} />
      </main>

      <CartBar onViewOrder={() => setCartOpen(true)} />
      <CartDrawer
        open={cartOpen}
        onOpenChange={setCartOpen}
        tableId={tableId}
        onSuccess={handleOrderSuccess}
      />
      {confirmed && lastOrderId && (
        <OrderConfirmation
          tableId={tableId}
          onDismiss={() => { setConfirmed(false); setLastOrderId(null) }}
        />
      )}
    </CartProvider>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add menu/src/app/[tableId]/MenuShell.tsx
git commit -m "feat(menu): MenuShell client wrapper with cart + confirmation state"
```

---

### Task 9: CatchStrip with Realtime

**Files:** `menu/src/app/[tableId]/components/CatchStrip.tsx`

- [ ] **Step 1: Create `menu/src/app/[tableId]/components/CatchStrip.tsx`**

```typescript
'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useCart } from '@/lib/cart'
import { cn } from '@/lib/cn'
import type { CatchWithAvailability } from '../page'

function SpiceDots({ level }: { level: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <span
          key={i}
          className={cn(
            'w-2 h-2 rounded-full',
            i < level ? 'bg-accent' : 'bg-border'
          )}
        />
      ))}
    </div>
  )
}

interface Props {
  initialItems: CatchWithAvailability[]
  tableId: string
}

export function CatchStrip({ initialItems }: Props) {
  const [items, setItems] = useState(initialItems)
  const { items: cartItems, dispatch } = useCart()

  useEffect(() => {
    const channel = supabase
      .channel('catch-availability')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'daily_availability',
      }, (payload) => {
        const updated = payload.new as { catch_item_id: string; status: string; notes: string }
        setItems(prev =>
          prev.map(item =>
            item.id === updated.catch_item_id
              ? { ...item, status: updated.status as CatchWithAvailability['status'], notes: updated.notes }
              : item
          )
        )
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  if (items.length === 0) return null

  return (
    <section className="py-5 px-4">
      <div className="flex items-center gap-2 mb-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">Today's Catch</p>
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse-slow" />
          <span className="text-[10px] text-emerald-600 font-medium">Live</span>
        </span>
      </div>
      <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2 -mx-4 px-4">
        {items.map(item => {
          const available = item.status === 'available'
          const soldOut = item.status === 'sold_out'
          const cartItem = cartItems.find(c => c.id === item.id)

          return (
            <div
              key={item.id}
              className={cn(
                'flex-shrink-0 w-44 bg-card rounded-2xl shadow-sm ring-1 ring-black/5 overflow-hidden',
                soldOut && 'opacity-60'
              )}
            >
              {/* Teal top border for available */}
              <div className={cn('h-1', available ? 'bg-primary' : 'bg-border')} />
              <div className="p-3">
                <div className="flex items-start justify-between mb-1">
                  <p className="font-semibold text-foreground text-sm leading-tight">{item.name}</p>
                  {soldOut && (
                    <span className="text-[9px] font-bold uppercase text-rose-500 bg-rose-50 px-1.5 py-0.5 rounded-full ml-1 flex-shrink-0">
                      Sold out
                    </span>
                  )}
                </div>
                {item.local_name && (
                  <p className="text-[10px] text-muted-foreground mb-1">{item.local_name} · {item.origin_region}</p>
                )}
                <SpiceDots level={item.spice_level} />
                <p className="text-[10px] text-muted-foreground mt-1.5 line-clamp-2">{item.recommended_preps.join(', ')}</p>

                {available && (
                  <div className="mt-3">
                    {!cartItem ? (
                      <button
                        onClick={() => dispatch({
                          type: 'ADD',
                          item: { id: item.id, itemType: 'catch', name: item.name, price: 0 },
                        })}
                        className="w-full text-xs font-semibold bg-primary text-primary-foreground py-1.5 rounded-lg"
                      >
                        + Add
                      </button>
                    ) : (
                      <div className="flex items-center justify-between bg-primary/10 rounded-lg px-2 py-1">
                        <button onClick={() => dispatch({ type: 'UPDATE_QTY', id: item.id, qty: cartItem.qty - 1 })} className="text-primary font-bold text-lg w-6 text-center">−</button>
                        <span className="text-sm font-semibold text-primary">{cartItem.qty}</span>
                        <button onClick={() => dispatch({ type: 'UPDATE_QTY', id: item.id, qty: cartItem.qty + 1 })} className="text-primary font-bold text-lg w-6 text-center">+</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add menu/src/app/[tableId]/components/CatchStrip.tsx
git commit -m "feat(menu): CatchStrip with Supabase Realtime availability"
```

---

### Task 10: DishCard and MenuTabs

**Files:** `menu/src/app/[tableId]/components/DishCard.tsx`, `menu/src/app/[tableId]/components/MenuTabs.tsx`

- [ ] **Step 1: Create `menu/src/app/[tableId]/components/DishCard.tsx`**

```typescript
'use client'
import { useState } from 'react'
import Image from 'next/image'
import { MessageCircle } from 'lucide-react'
import { useCart } from '@/lib/cart'
import { cn } from '@/lib/cn'
import { AskPanel } from './AskPanel'
import type { MenuItem } from '../page'

function SpiceDots({ level }: { level: number | null }) {
  if (!level) return null
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={cn('w-2 h-2 rounded-full', i < level ? 'bg-accent' : 'bg-border')} />
      ))}
    </div>
  )
}

export function DishCard({ item }: { item: MenuItem }) {
  const [askOpen, setAskOpen] = useState(false)
  const { items: cartItems, dispatch } = useCart()
  const cartItem = cartItems.find(c => c.id === item.id)

  return (
    <>
      <div className="bg-card rounded-2xl shadow-sm ring-1 ring-black/5 overflow-hidden">
        {item.image_url ? (
          <div className="relative w-full aspect-[4/3]">
            <Image
              src={item.image_url}
              alt={item.name}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 50vw, 33vw"
            />
          </div>
        ) : (
          <div className="w-full aspect-[4/3] bg-gradient-to-br from-muted to-border flex items-center justify-center">
            <span className="text-3xl">🐟</span>
          </div>
        )}

        <div className="p-4">
          <div className="flex items-start justify-between gap-2 mb-1">
            <p className="font-bold text-foreground text-base leading-tight">{item.name}</p>
            <p className="font-semibold text-primary text-sm flex-shrink-0">₹{item.price}</p>
          </div>

          <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{item.description}</p>

          <div className="flex items-center gap-2 mb-3">
            <SpiceDots level={item.spice_level} />
            {item.allergens.length > 0 && (
              <div className="flex gap-1 flex-wrap">
                {item.allergens.map(a => (
                  <span key={a} className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">
                    {a}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {!cartItem ? (
              <button
                onClick={() => dispatch({
                  type: 'ADD',
                  item: { id: item.id, itemType: 'menu', name: item.name, price: item.price },
                })}
                className="flex-1 text-sm font-semibold bg-primary text-primary-foreground py-2 rounded-xl"
              >
                + Add
              </button>
            ) : (
              <div className="flex-1 flex items-center justify-between bg-primary/10 rounded-xl px-3 py-1.5">
                <button onClick={() => dispatch({ type: 'UPDATE_QTY', id: item.id, qty: cartItem.qty - 1 })} className="text-primary font-bold text-lg w-6 text-center">−</button>
                <span className="text-sm font-semibold text-primary">{cartItem.qty}</span>
                <button onClick={() => dispatch({ type: 'UPDATE_QTY', id: item.id, qty: cartItem.qty + 1 })} className="text-primary font-bold text-lg w-6 text-center">+</button>
              </div>
            )}
            <button
              onClick={() => setAskOpen(true)}
              className="flex items-center gap-1 text-xs text-accent font-medium border border-accent/30 px-2.5 py-2 rounded-xl hover:bg-accent/5 transition-colors"
            >
              <MessageCircle size={13} />
              Ask
            </button>
          </div>
        </div>
      </div>

      {askOpen && <AskPanel item={item} onClose={() => setAskOpen(false)} />}
    </>
  )
}
```

- [ ] **Step 2: Create `menu/src/app/[tableId]/components/MenuTabs.tsx`**

```typescript
'use client'
import { useState } from 'react'
import { DishCard } from './DishCard'
import { cn } from '@/lib/cn'
import type { MenuItem } from '../page'

const CATEGORY_ORDER = ['Starters', 'Mains', 'Breads', 'Desserts', 'Drinks']

function orderCategory(cat: string): number {
  const idx = CATEGORY_ORDER.indexOf(cat)
  return idx === -1 ? 99 : idx
}

export function MenuTabs({ menuItems }: { menuItems: MenuItem[] }) {
  const categories = Array.from(new Set(menuItems.map(i => i.category)))
    .sort((a, b) => orderCategory(a) - orderCategory(b))

  const [active, setActive] = useState(categories[0] ?? '')
  const filtered = menuItems.filter(i => i.category === active)

  if (categories.length === 0) return (
    <p className="text-center text-muted-foreground py-12 text-sm">Menu coming soon.</p>
  )

  return (
    <section className="px-4">
      {/* Tab bar */}
      <div className="flex gap-1 overflow-x-auto scrollbar-hide pb-3 -mx-4 px-4 mb-4">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setActive(cat)}
            className={cn(
              'flex-shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition-colors',
              active === cat
                ? 'bg-primary text-primary-foreground'
                : 'bg-card text-muted-foreground ring-1 ring-border'
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Dish grid */}
      <div className="grid grid-cols-2 gap-3">
        {filtered.map(item => <DishCard key={item.id} item={item} />)}
      </div>
    </section>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add menu/src/app/[tableId]/components/DishCard.tsx menu/src/app/[tableId]/components/MenuTabs.tsx
git commit -m "feat(menu): DishCard and MenuTabs components"
```

---

### Task 11: CartBar and CartDrawer

**Files:** `menu/src/app/[tableId]/components/CartBar.tsx`, `menu/src/app/[tableId]/components/CartDrawer.tsx`

- [ ] **Step 1: Create `menu/src/app/[tableId]/components/CartBar.tsx`**

```typescript
'use client'
import { ShoppingBag } from 'lucide-react'
import { useCart } from '@/lib/cart'

export function CartBar({ onViewOrder }: { onViewOrder: () => void }) {
  const { itemCount, total } = useCart()

  if (itemCount === 0) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-gradient-to-t from-background via-background/80 to-transparent pointer-events-none">
      <button
        onClick={onViewOrder}
        className="pointer-events-auto w-full bg-primary text-primary-foreground rounded-2xl px-5 py-4 flex items-center justify-between shadow-xl"
      >
        <div className="flex items-center gap-3">
          <div className="bg-primary-foreground/20 w-8 h-8 rounded-full flex items-center justify-center">
            <ShoppingBag size={16} />
          </div>
          <span className="font-semibold text-sm">{itemCount} item{itemCount !== 1 ? 's' : ''}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-bold">₹{total.toLocaleString('en-IN')}</span>
          <span className="text-primary-foreground/60 text-sm">View Order →</span>
        </div>
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Create `menu/src/app/[tableId]/components/CartDrawer.tsx`**

```typescript
'use client'
import { useState } from 'react'
import { Drawer } from 'vaul'
import { Loader2, X } from 'lucide-react'
import { useCart } from '@/lib/cart'
import { backendPost } from '@/lib/backend'
import { cn } from '@/lib/cn'

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  tableId: string
  onSuccess: (orderId: string) => void
}

export function CartDrawer({ open, onOpenChange, tableId, onSuccess }: Props) {
  const { items, total, dispatch } = useCart()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function placeOrder() {
    setLoading(true)
    setError(null)
    try {
      const orderItems = items.map(item => ({
        ...(item.itemType === 'catch' ? { catch_item_id: item.id } : { menu_item_id: item.id }),
        qty: item.qty,
        ...(item.notes ? { notes: item.notes } : {}),
      }))
      const result = await backendPost<{ ok: boolean; id: string }>('/orders', {
        table_id: tableId,
        items: orderItems,
      })
      dispatch({ type: 'CLEAR' })
      onSuccess(result.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/40 z-50" />
        <Drawer.Content className="fixed bottom-0 left-0 right-0 z-50 bg-card rounded-t-3xl max-h-[85vh] flex flex-col">
          <Drawer.Title className="sr-only">Your Order</Drawer.Title>
          <Drawer.Description className="sr-only">Review your items and place order</Drawer.Description>
          <div className="w-10 h-1.5 bg-border rounded-full mx-auto mt-3 mb-1 flex-shrink-0" />

          <div className="px-5 py-3 border-b border-border flex-shrink-0">
            <p className="font-bold text-foreground text-lg">Your Order</p>
            <p className="text-xs text-muted-foreground">Table {tableId}</p>
          </div>

          <div className="overflow-y-auto flex-1 px-5 py-4 space-y-3" data-vaul-no-drag>
            {items.map(item => (
              <div key={item.id} className="flex items-center gap-3">
                <div className="flex items-center gap-2 bg-muted rounded-xl px-2 py-1">
                  <button onClick={() => dispatch({ type: 'UPDATE_QTY', id: item.id, qty: item.qty - 1 })} className="text-primary font-bold w-5 text-center">−</button>
                  <span className="text-sm font-semibold text-foreground w-4 text-center">{item.qty}</span>
                  <button onClick={() => dispatch({ type: 'UPDATE_QTY', id: item.id, qty: item.qty + 1 })} className="text-primary font-bold w-5 text-center">+</button>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{item.name}</p>
                  {item.itemType === 'catch' && (
                    <p className="text-[10px] text-accent font-medium">Today's catch</p>
                  )}
                </div>
                {item.price > 0 && (
                  <p className="text-sm font-semibold text-foreground">₹{(item.price * item.qty).toLocaleString('en-IN')}</p>
                )}
                <button onClick={() => dispatch({ type: 'REMOVE', id: item.id })} className="text-muted-foreground hover:text-foreground">
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>

          <div className="px-5 py-4 border-t border-border flex-shrink-0">
            {total > 0 && (
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-muted-foreground font-medium">Subtotal</p>
                <p className="font-bold text-foreground">₹{total.toLocaleString('en-IN')}</p>
              </div>
            )}
            {error && <p className="text-xs text-rose-600 mb-3 text-center">{error}</p>}
            <button
              onClick={placeOrder}
              disabled={loading || items.length === 0}
              className={cn(
                'w-full bg-primary text-primary-foreground font-bold py-4 rounded-2xl text-sm flex items-center justify-center gap-2',
                'disabled:opacity-50 transition-opacity'
              )}
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              {loading ? 'Placing order…' : 'Place Order'}
            </button>
            <p className="text-[10px] text-muted-foreground text-center mt-2">A waiter will confirm your order shortly</p>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add menu/src/app/[tableId]/components/CartBar.tsx menu/src/app/[tableId]/components/CartDrawer.tsx
git commit -m "feat(menu): CartBar and CartDrawer with order submission"
```

---

### Task 12: AskPanel — Claude dish chat

**Files:** `menu/src/app/[tableId]/components/AskPanel.tsx`

- [ ] **Step 1: Create `menu/src/app/[tableId]/components/AskPanel.tsx`**

```typescript
'use client'
import { useState, useRef, useEffect } from 'react'
import { X, Send, Loader2 } from 'lucide-react'
import { backendPost } from '@/lib/backend'
import { cn } from '@/lib/cn'
import type { MenuItem } from '../page'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface Props {
  item: MenuItem
  onClose: () => void
}

export function AskPanel({ item, onClose }: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function send() {
    const text = input.trim()
    if (!text || loading) return
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: text }])
    setLoading(true)
    try {
      const result = await backendPost<{ ok: boolean; reply: string }>('/menu/ask', {
        dish: {
          name: item.name,
          description: item.description,
          spice_level: item.spice_level,
          allergens: item.allergens,
          price: item.price,
        },
        message: text,
      })
      setMessages(prev => [...prev, { role: 'assistant', content: result.reply }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I could not answer that right now.' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card flex-shrink-0">
        <div>
          <p className="font-bold text-foreground text-sm">Ask about {item.name}</p>
          <p className="text-[11px] text-muted-foreground">Powered by Claude AI</p>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1">
          <X size={20} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <p className="text-2xl mb-2">🐟</p>
            <p className="text-sm text-muted-foreground">Ask anything about {item.name}</p>
            <div className="flex flex-wrap gap-2 justify-center mt-3">
              {['Can I get this boneless?', 'How spicy is this really?', 'Any allergens?'].map(q => (
                <button
                  key={q}
                  onClick={() => { setInput(q); }}
                  className="text-xs bg-muted text-muted-foreground px-3 py-1.5 rounded-full hover:bg-primary/10 hover:text-primary transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
            <div className={cn(
              'max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed',
              msg.role === 'user'
                ? 'bg-primary text-primary-foreground rounded-br-sm'
                : 'bg-card ring-1 ring-border text-foreground rounded-bl-sm'
            )}>
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-card ring-1 ring-border px-4 py-3 rounded-2xl rounded-bl-sm">
              <Loader2 size={14} className="animate-spin text-muted-foreground" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-border bg-card flex-shrink-0 flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
          placeholder={`Ask about ${item.name}…`}
          className="flex-1 bg-muted rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/30"
        />
        <button
          onClick={send}
          disabled={!input.trim() || loading}
          className="bg-primary text-primary-foreground w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 disabled:opacity-40"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add menu/src/app/[tableId]/components/AskPanel.tsx
git commit -m "feat(menu): AskPanel Claude dish chat"
```

---

### Task 13: OrderConfirmation

**Files:** `menu/src/app/[tableId]/components/OrderConfirmation.tsx`

- [ ] **Step 1: Create `menu/src/app/[tableId]/components/OrderConfirmation.tsx`**

```typescript
'use client'
import { useEffect, useState } from 'react'
import { CheckCircle2 } from 'lucide-react'

interface Props {
  tableId: string
  onDismiss: () => void
}

export function OrderConfirmation({ tableId, onDismiss }: Props) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Animate in
    requestAnimationFrame(() => setVisible(true))
    // Auto-dismiss after 4 seconds
    const t = setTimeout(onDismiss, 4000)
    return () => clearTimeout(t)
  }, [onDismiss])

  return (
    <div
      className={`fixed inset-0 z-50 bg-primary flex flex-col items-center justify-center px-8 transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`}
    >
      <CheckCircle2 size={72} className="text-primary-foreground mb-6 opacity-90" strokeWidth={1.5} />
      <p className="text-primary-foreground font-bold text-2xl text-center mb-2">Order placed!</p>
      <p className="text-primary-foreground/70 text-sm text-center mb-1">Table {tableId}</p>
      <p className="text-primary-foreground/60 text-xs text-center">A waiter will confirm and bring your order shortly</p>

      <button
        onClick={onDismiss}
        className="mt-10 bg-primary-foreground/10 border border-primary-foreground/20 text-primary-foreground px-6 py-3 rounded-2xl text-sm font-semibold"
      >
        Order more
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add menu/src/app/[tableId]/components/OrderConfirmation.tsx
git commit -m "feat(menu): OrderConfirmation full-screen overlay"
```

---

### Task 14: PWA manifest and service worker

**Files:** `menu/public/manifest.json`, `menu/public/sw.js`

- [ ] **Step 1: Create `menu/public/manifest.json`**

```json
{
  "name": "Sanadige",
  "short_name": "Sanadige",
  "description": "Fresh coastal seafood from Goa, Kerala & Karnataka",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#f8f3ec",
  "theme_color": "#1a3a38",
  "icons": [
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ]
}
```

- [ ] **Step 2: Create `menu/public/sw.js`**

```javascript
const CACHE = 'sanadige-menu-v1'
const SHELL = ['/', '/manifest.json']

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', event => {
  // Only cache GET requests
  if (event.request.method !== 'GET') return

  // Network-first for API calls; cache-first for shell assets
  const url = new URL(event.request.url)
  if (url.hostname.includes('supabase') || url.hostname.includes('shopthryv')) {
    // Network only — no caching for API/Supabase calls
    return
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached
      return fetch(event.request).then(res => {
        const clone = res.clone()
        caches.open(CACHE).then(c => c.put(event.request, clone))
        return res
      })
    })
  )
})
```

- [ ] **Step 3: Add placeholder icons (required for PWA)**

Create a 192×192 and 512×512 teal square PNG as placeholder icons. These can be replaced with real brand icons later.

```bash
# Quick placeholder — create icons dir and copy any available PNG or generate with ImageMagick if available
mkdir -p public/icons
# If ImageMagick is available:
convert -size 192x192 xc:'#1a3a38' public/icons/icon-192.png 2>/dev/null || echo "Add icon-192.png and icon-512.png to menu/public/icons/ manually"
convert -size 512x512 xc:'#1a3a38' public/icons/icon-512.png 2>/dev/null || echo "Add icon-512.png to menu/public/icons/ manually"
```

- [ ] **Step 4: Commit**

```bash
git add menu/public/manifest.json menu/public/sw.js menu/public/icons/
git commit -m "feat(menu): PWA manifest and service worker"
```

---

### Task 15: Local dev smoke test

- [ ] **Step 1: Start the dev server**

```bash
cd menu && npm run dev
```

Expected: `▲ Next.js` ready on `http://localhost:3001`

- [ ] **Step 2: Open `http://localhost:3001/T3` in browser**

Expected:
- Header shows "Sanadige" wordmark and "Table T3" badge
- Today's Catch strip renders (may be empty if no data for today)
- Menu tabs render with dish cards
- Tapping "+ Add" on any dish shows qty controls and the cart bar appears at bottom
- Tapping "Ask" on a dish opens the full-screen chat panel
- Tapping "View Order" opens the cart drawer
- Tapping "Place Order" submits to backend and shows confirmation screen

- [ ] **Step 3: Commit final wiring**

```bash
git add menu/
git commit -m "feat(menu): complete menu PWA — catch strip, dish cards, cart, ask panel, order flow"
```

---

### Task 16: Deploy to Vercel

- [ ] **Step 1: Add `menu/` as a new Vercel project**

In Vercel dashboard: New Project → Import `Sanadige` monorepo → Set **Root Directory** to `menu` → Set **Framework** to Next.js.

- [ ] **Step 2: Add environment variables in Vercel**

```
NEXT_PUBLIC_SUPABASE_URL = https://dbgxjcjynuqibztdjtub.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY = <from Supabase dashboard: Settings → API → anon public>
NEXT_PUBLIC_BACKEND_URL = https://sanadigapi.shopthryv.in
```

- [ ] **Step 3: Set custom domain**

In Vercel project settings → Domains → Add `menu.sanadige.in` → update DNS CNAME to `cname.vercel-dns.com`.
