# QR Menu — Plan 3: Dashboard Orders Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/dashboard/orders` page to the existing staff dashboard with a live swimlane view of all orders (Pending / Acknowledged / Served), real-time updates via Supabase Realtime, and a "New Order" drawer where managers and waiters can manually take orders by table.

**Architecture:** The existing Next.js dashboard app gets a new `orders/` page. A server component fetches initial orders and menu data; an `OrdersBoard` client component handles Supabase Realtime subscriptions and renders three swimlane columns. A `TakeOrderDrawer` client component (manager/waiter only) re-uses the same dish card pattern from the menu PWA. The `waiter` role is added to the `Role` type and auth system.

**Tech Stack:** Next.js 16, TypeScript, Tailwind CSS v4, `@supabase/supabase-js` (browser client for Realtime), `vaul`, `lucide-react`.

**Prerequisites:** Plan 1 (backend) must be deployed — `GET /orders`, `PATCH /orders/:id/status`, and `POST /orders` must be live. The `003_waiter_role.sql` migration must have been run.

**Working directory for all commands:** `dashboard/`

---

## File Map

| Action | File |
|---|---|
| Modify | `dashboard/src/lib/auth.ts` — add `waiter` to `Role` |
| Modify | `dashboard/src/components/shell/Sidebar.tsx` — add Orders nav + waiter style |
| Modify | `dashboard/src/app/dashboard/page.tsx` — waiter redirect |
| Create | `dashboard/src/lib/supabase-browser.ts` — anon browser client for Realtime |
| Create | `dashboard/src/actions/orders.ts` — server actions for status update |
| Create | `dashboard/src/app/dashboard/orders/page.tsx` — server component |
| Create | `dashboard/src/components/orders/OrdersBoard.tsx` — client Realtime swimlanes |
| Create | `dashboard/src/components/orders/TakeOrderDrawer.tsx` — manual order entry |
| Modify | `dashboard/.env.local` — add `NEXT_PUBLIC_SUPABASE_ANON_KEY` |

---

### Task 1: Add waiter role to auth and sidebar

**Files:**
- Modify: `dashboard/src/lib/auth.ts`
- Modify: `dashboard/src/components/shell/Sidebar.tsx`
- Modify: `dashboard/src/app/dashboard/page.tsx`

- [ ] **Step 1: Update `dashboard/src/lib/auth.ts`**

Change line 3:

```typescript
export type Role = 'manager' | 'chef' | 'host' | 'waiter'
```

(The rest of the file is unchanged.)

- [ ] **Step 2: Update `dashboard/src/components/shell/Sidebar.tsx`**

Replace the full file:

```typescript
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Fish, CalendarDays, Map, Users, BarChart3, UtensilsCrossed } from 'lucide-react'
import { type Role } from '@/lib/auth'

interface NavItem {
  href: string
  label: string
  roles: Role[]
  icon: React.ElementType
}

const NAV: NavItem[] = [
  { href: '/dashboard', label: 'Mission Control', roles: ['manager'], icon: LayoutDashboard },
  { href: '/dashboard/catch', label: "Today's Catch", roles: ['manager', 'chef'], icon: Fish },
  { href: '/dashboard/bookings', label: 'Bookings', roles: ['manager', 'host', 'waiter'], icon: CalendarDays },
  { href: '/dashboard/orders', label: 'Live Orders', roles: ['manager', 'chef', 'waiter'], icon: UtensilsCrossed },
  { href: '/dashboard/floor', label: 'Floor Map', roles: ['manager', 'host'], icon: Map },
  { href: '/dashboard/staff', label: 'Staff', roles: ['manager'], icon: Users },
  { href: '/dashboard/analytics', label: 'Analytics', roles: ['manager'], icon: BarChart3 },
]

const ROLE_STYLE: Record<string, string> = {
  manager: 'bg-accent/20 text-accent-foreground',
  host: 'bg-sidebar-accent text-sidebar-accent-foreground',
  chef: 'bg-amber-500/20 text-amber-200',
  waiter: 'bg-emerald-500/20 text-emerald-200',
}

export function Sidebar({ role, name }: { role: Role; name?: string }) {
  const pathname = usePathname()
  const items = NAV.filter(item => item.roles.includes(role))

  return (
    <aside className="hidden md:flex flex-col w-[230px] min-h-screen bg-sidebar border-r border-sidebar-border">
      <div className="px-5 py-6 border-b border-sidebar-border">
        <p className="text-sidebar-foreground font-bold text-xl tracking-tight">Sanadige</p>
        <p className="text-[11px] text-sidebar-foreground/50 mt-0.5">Where the coast meets Delhi</p>
      </div>

      <nav className="flex flex-col gap-0.5 px-3 py-4 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-sidebar-foreground/40 px-2 mb-2">Navigation</p>
        {items.map(item => {
          const active = pathname === item.href
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                active
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground border-l-2 border-accent pl-[10px]'
                  : 'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50'
              }`}
            >
              <Icon size={16} strokeWidth={active ? 2.5 : 1.8} />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {name && (
        <div className="px-4 py-4 border-t border-sidebar-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center flex-shrink-0">
              <span className="text-accent-foreground text-sm font-bold">{name[0]?.toUpperCase()}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sidebar-foreground text-sm font-medium truncate">{name}</p>
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full uppercase tracking-wide ${ROLE_STYLE[role] ?? ''}`}>
                {role}
              </span>
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}
```

- [ ] **Step 3: Update `dashboard/src/app/dashboard/page.tsx`**

```typescript
import { redirect } from 'next/navigation'
import { getSession } from '@/actions/auth'
import { MissionControl } from './_components/MissionControl'

export default async function DashboardPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (session.role === 'chef') redirect('/dashboard/catch')
  if (session.role === 'host') redirect('/dashboard/bookings')
  if (session.role === 'waiter') redirect('/dashboard/orders')
  return <MissionControl />
}
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/auth.ts src/components/shell/Sidebar.tsx src/app/dashboard/page.tsx
git commit -m "feat(dashboard): add waiter role, Live Orders nav item"
```

---

### Task 2: Supabase browser client for Realtime

**Files:**
- Create: `dashboard/src/lib/supabase-browser.ts`
- Modify: `dashboard/.env.local`

- [ ] **Step 1: Add anon key to `dashboard/.env.local`**

Append this line (get the value from Supabase dashboard → Settings → API → anon public):

```
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon public key>
```

- [ ] **Step 2: Create `dashboard/src/lib/supabase-browser.ts`**

```typescript
import { createClient } from '@supabase/supabase-js'

export const supabaseBrowser = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/supabase-browser.ts
git commit -m "feat(dashboard): add browser Supabase client for Realtime"
```

---

### Task 3: Orders server actions

**Files:**
- Create: `dashboard/src/actions/orders.ts`

- [ ] **Step 1: Create `dashboard/src/actions/orders.ts`**

```typescript
'use server'
import { revalidatePath } from 'next/cache'
import { backendPost } from '@/lib/backend'

export async function updateOrderStatus(
  id: string,
  status: 'acknowledged' | 'served'
): Promise<void> {
  const BASE = process.env.BACKEND_URL!.replace(/\/$/, '')
  await fetch(`${BASE}/orders/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  })
  revalidatePath('/dashboard/orders')
}

export async function createOrderFromDashboard(data: {
  table_id: string
  items: { catch_item_id?: string; menu_item_id?: string; qty: number; notes?: string }[]
}): Promise<{ ok: boolean; id: string }> {
  const result = await backendPost<{ ok: boolean; id: string }>('/orders', data)
  revalidatePath('/dashboard/orders')
  return result
}
```

- [ ] **Step 2: Commit**

```bash
git add src/actions/orders.ts
git commit -m "feat(dashboard): orders server actions"
```

---

### Task 4: Orders server page

**Files:**
- Create: `dashboard/src/app/dashboard/orders/page.tsx`

- [ ] **Step 1: Create `dashboard/src/app/dashboard/orders/page.tsx`**

```typescript
import { redirect } from 'next/navigation'
import { getSession } from '@/actions/auth'
import { getSupabase } from '@/lib/supabase'
import { OrdersBoard } from '@/components/orders/OrdersBoard'

export interface Order {
  id: string
  table_id: string
  booking_id: string | null
  items: { catch_item_id?: string; menu_item_id?: string; qty: number; notes?: string }[]
  status: 'pending' | 'acknowledged' | 'served'
  created_at: string
}

export interface CatchOption {
  id: string
  name: string
  spice_level: number
  recommended_preps: string[]
}

export interface MenuOption {
  id: string
  name: string
  category: string
  price: number
  spice_level: number | null
}

export default async function OrdersPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const allowed: string[] = ['manager', 'chef', 'waiter']
  if (!allowed.includes(session.role)) redirect('/dashboard')

  const supabase = getSupabase()
  const today = new Date().toISOString().split('T')[0]
  const startUTC = new Date(`${today}T00:00:00+05:30`).toISOString()
  const endUTC = new Date(`${today}T23:59:59+05:30`).toISOString()

  const [ordersRes, catchRes, menuRes] = await Promise.all([
    supabase
      .from('orders')
      .select('*')
      .gte('created_at', startUTC)
      .lte('created_at', endUTC)
      .order('created_at'),
    supabase
      .from('catch_items')
      .select('id, name, spice_level, recommended_preps'),
    supabase
      .from('menu_items')
      .select('id, name, category, price, spice_level')
      .eq('is_available', true)
      .order('category'),
  ])

  const canTakeOrder = session.role === 'manager' || session.role === 'waiter'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Live Orders</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Updates in real-time</p>
        </div>
      </div>
      <OrdersBoard
        initialOrders={(ordersRes.data ?? []) as Order[]}
        catchOptions={(catchRes.data ?? []) as CatchOption[]}
        menuOptions={(menuRes.data ?? []) as MenuOption[]}
        canTakeOrder={canTakeOrder}
        role={session.role}
      />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/dashboard/orders/page.tsx
git commit -m "feat(dashboard): orders page server component"
```

---

### Task 5: OrdersBoard — Realtime swimlanes

**Files:**
- Create: `dashboard/src/components/orders/OrdersBoard.tsx`

- [ ] **Step 1: Create `dashboard/src/components/orders/OrdersBoard.tsx`**

```typescript
'use client'
import { useEffect, useState } from 'react'
import { supabaseBrowser } from '@/lib/supabase-browser'
import { updateOrderStatus } from '@/actions/orders'
import { TakeOrderDrawer } from './TakeOrderDrawer'
import { cn } from '@/lib/utils'
import type { Order, CatchOption, MenuOption } from '@/app/dashboard/orders/page'

function formatIST(datetime: string) {
  const d = new Date(datetime)
  const ist = new Date(d.getTime() + 5.5 * 60 * 60 * 1000)
  const h = ist.getUTCHours()
  const m = ist.getUTCMinutes()
  const period = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return `${hour.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} ${period}`
}

const COLUMNS: { key: Order['status']; label: string; headerClass: string; dotClass: string }[] = [
  { key: 'pending', label: 'Pending', headerClass: 'bg-amber-50 text-amber-800 ring-1 ring-amber-200', dotClass: 'bg-amber-500' },
  { key: 'acknowledged', label: 'Acknowledged', headerClass: 'bg-primary/10 text-primary ring-1 ring-primary/20', dotClass: 'bg-primary' },
  { key: 'served', label: 'Served', headerClass: 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200', dotClass: 'bg-emerald-500' },
]

function OrderCard({ order, onAction }: { order: Order; onAction: (id: string, status: 'acknowledged' | 'served') => void }) {
  return (
    <div className="bg-card shadow-sm ring-1 ring-black/5 rounded-2xl p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-2xl font-bold text-primary leading-none">{order.table_id}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{formatIST(order.created_at)}</p>
        </div>
        <span className={cn(
          'text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full',
          order.status === 'pending' && 'bg-amber-50 text-amber-700',
          order.status === 'acknowledged' && 'bg-primary/10 text-primary',
          order.status === 'served' && 'bg-emerald-50 text-emerald-700',
        )}>
          {order.status}
        </span>
      </div>

      <div className="space-y-1.5">
        {order.items.map((item, i) => (
          <div key={i} className="flex items-start gap-2">
            <span className="text-xs font-bold text-muted-foreground w-5 flex-shrink-0">×{item.qty}</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-foreground font-medium">{item.catch_item_id ? `Catch: ${item.catch_item_id.slice(0, 8)}…` : `Menu item`}</p>
              {item.notes && <p className="text-[10px] text-muted-foreground italic">{item.notes}</p>}
            </div>
          </div>
        ))}
      </div>

      {order.status === 'pending' && (
        <button
          onClick={() => onAction(order.id, 'acknowledged')}
          className="w-full text-xs font-semibold bg-primary text-primary-foreground py-2 rounded-xl"
        >
          Acknowledge
        </button>
      )}
      {order.status === 'acknowledged' && (
        <button
          onClick={() => onAction(order.id, 'served')}
          className="w-full text-xs font-semibold bg-emerald-600 text-white py-2 rounded-xl"
        >
          Mark Served
        </button>
      )}
    </div>
  )
}

interface Props {
  initialOrders: Order[]
  catchOptions: CatchOption[]
  menuOptions: MenuOption[]
  canTakeOrder: boolean
  role: string
}

export function OrdersBoard({ initialOrders, catchOptions, menuOptions, canTakeOrder }: Props) {
  const [orders, setOrders] = useState(initialOrders)
  const [drawerOpen, setDrawerOpen] = useState(false)

  useEffect(() => {
    const channel = supabaseBrowser
      .channel('orders-board')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'orders',
      }, payload => {
        setOrders(prev => [...prev, payload.new as Order])
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'orders',
      }, payload => {
        setOrders(prev =>
          prev.map(o => o.id === (payload.new as Order).id ? payload.new as Order : o)
        )
      })
      .subscribe()

    return () => { supabaseBrowser.removeChannel(channel) }
  }, [])

  async function handleAction(id: string, status: 'acknowledged' | 'served') {
    // Optimistic update
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o))
    await updateOrderStatus(id, status)
  }

  return (
    <>
      {canTakeOrder && (
        <div className="flex justify-end">
          <button
            onClick={() => setDrawerOpen(true)}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-4 py-2.5 rounded-lg text-sm"
          >
            + New Order
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {COLUMNS.map(col => {
          const colOrders = orders.filter(o => o.status === col.key)
          return (
            <div key={col.key} className="space-y-3">
              <div className={cn('flex items-center gap-2 px-3 py-2 rounded-xl', col.headerClass)}>
                <span className={cn('w-2 h-2 rounded-full flex-shrink-0', col.dotClass)} />
                <p className="text-xs font-bold uppercase tracking-[0.15em]">{col.label}</p>
                <span className="ml-auto text-xs font-bold opacity-60">{colOrders.length}</span>
              </div>
              <div className="space-y-3">
                {colOrders.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-8">No {col.label.toLowerCase()} orders</p>
                )}
                {colOrders.map(order => (
                  <OrderCard key={order.id} order={order} onAction={handleAction} />
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {canTakeOrder && (
        <TakeOrderDrawer
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          catchOptions={catchOptions}
          menuOptions={menuOptions}
          onOrderPlaced={order => {
            setOrders(prev => [...prev, order])
            setDrawerOpen(false)
          }}
        />
      )}
    </>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/orders/OrdersBoard.tsx
git commit -m "feat(dashboard): OrdersBoard with Realtime swimlanes"
```

---

### Task 6: TakeOrderDrawer — manual order entry

**Files:**
- Create: `dashboard/src/components/orders/TakeOrderDrawer.tsx`

- [ ] **Step 1: Create `dashboard/src/components/orders/TakeOrderDrawer.tsx`**

```typescript
'use client'
import { useState, useTransition } from 'react'
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { createOrderFromDashboard } from '@/actions/orders'
import { cn } from '@/lib/utils'
import type { CatchOption, MenuOption, Order } from '@/app/dashboard/orders/page'

const TABLE_IDS = [
  'Terrace-1', 'Terrace-2', 'Terrace-3', 'Terrace-4', 'Terrace-5', 'Terrace-6', 'Terrace-7', 'Terrace-8',
  'Floor1-1', 'Floor1-2', 'Floor1-3', 'Floor1-4', 'Floor1-5', 'Floor1-6',
  'Floor2-1', 'Floor2-2', 'Floor2-3', 'Floor2-4', 'Floor2-5', 'Floor2-6',
  'Private-1', 'Private-2',
]

const CATEGORY_ORDER = ['Starters', 'Mains', 'Breads', 'Desserts', 'Drinks']

interface CartEntry {
  id: string
  itemType: 'catch' | 'menu'
  name: string
  price: number
  qty: number
}

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  catchOptions: CatchOption[]
  menuOptions: MenuOption[]
  onOrderPlaced: (order: Order) => void
}

export function TakeOrderDrawer({ open, onOpenChange, catchOptions, menuOptions, onOrderPlaced }: Props) {
  const [tableId, setTableId] = useState('')
  const [cart, setCart] = useState<CartEntry[]>([])
  const [activeTab, setActiveTab] = useState<'catch' | string>('catch')
  const [, startTransition] = useTransition()

  const categories = Array.from(new Set(menuOptions.map(i => i.category)))
    .sort((a, b) => {
      const ai = CATEGORY_ORDER.indexOf(a)
      const bi = CATEGORY_ORDER.indexOf(b)
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
    })

  const tabs = ['catch', ...categories]

  function addItem(id: string, itemType: 'catch' | 'menu', name: string, price: number) {
    setCart(prev => {
      const existing = prev.find(c => c.id === id)
      if (existing) return prev.map(c => c.id === id ? { ...c, qty: c.qty + 1 } : c)
      return [...prev, { id, itemType, name, price, qty: 1 }]
    })
  }

  function updateQty(id: string, qty: number) {
    if (qty <= 0) setCart(prev => prev.filter(c => c.id !== id))
    else setCart(prev => prev.map(c => c.id === id ? { ...c, qty } : c))
  }

  function reset() {
    setTableId('')
    setCart([])
    setActiveTab('catch')
  }

  function handleOpenChange(v: boolean) {
    onOpenChange(v)
    if (!v) reset()
  }

  function submit() {
    if (!tableId || cart.length === 0) return
    startTransition(async () => {
      const items = cart.map(c => ({
        ...(c.itemType === 'catch' ? { catch_item_id: c.id } : { menu_item_id: c.id }),
        qty: c.qty,
      }))
      const result = await createOrderFromDashboard({ table_id: tableId, items })
      onOrderPlaced({
        id: result.id,
        table_id: tableId,
        booking_id: null,
        items,
        status: 'pending',
        created_at: new Date().toISOString(),
      })
      reset()
    })
  }

  const displayedItems = activeTab === 'catch'
    ? catchOptions
    : menuOptions.filter(i => i.category === activeTab)

  const total = cart.reduce((sum, c) => sum + c.price * c.qty, 0)

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>New Order</DrawerTitle>
          <DrawerDescription className="sr-only">Take an order by table number</DrawerDescription>
        </DrawerHeader>
        <div className="overflow-y-auto max-h-[70vh] px-6 pb-6" data-vaul-no-drag>
          <div className="space-y-5">
            {/* Table selector */}
            <div>
              <Label className="font-medium">Table</Label>
              <Select value={tableId} onValueChange={setTableId}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Select table…" />
                </SelectTrigger>
                <SelectContent>
                  {TABLE_IDS.map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Category tabs */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-6 px-6 scrollbar-hide">
              {tabs.map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    'flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold capitalize transition-colors',
                    activeTab === tab
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:text-foreground'
                  )}
                >
                  {tab === 'catch' ? "Today's Catch" : tab}
                </button>
              ))}
            </div>

            {/* Item list */}
            <div className="space-y-2">
              {displayedItems.map(item => {
                const id = (item as CatchOption | MenuOption).id
                const name = (item as CatchOption | MenuOption).name
                const price = 'price' in item ? item.price : 0
                const cartEntry = cart.find(c => c.id === id)

                return (
                  <div key={id} className="flex items-center justify-between bg-muted/40 rounded-xl px-3 py-2.5">
                    <div className="flex-1 min-w-0 mr-3">
                      <p className="text-sm font-medium text-foreground truncate">{name}</p>
                      {price > 0 && <p className="text-xs text-muted-foreground">₹{price}</p>}
                    </div>
                    {!cartEntry ? (
                      <button
                        onClick={() => addItem(id, activeTab === 'catch' ? 'catch' : 'menu', name, price)}
                        className="text-xs font-semibold bg-primary text-primary-foreground px-3 py-1.5 rounded-lg"
                      >
                        + Add
                      </button>
                    ) : (
                      <div className="flex items-center gap-2 bg-primary/10 rounded-lg px-2 py-1">
                        <button onClick={() => updateQty(id, cartEntry.qty - 1)} className="text-primary font-bold text-base w-5 text-center">−</button>
                        <span className="text-sm font-semibold text-primary w-4 text-center">{cartEntry.qty}</span>
                        <button onClick={() => updateQty(id, cartEntry.qty + 1)} className="text-primary font-bold text-base w-5 text-center">+</button>
                      </div>
                    )}
                  </div>
                )
              })}
              {displayedItems.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">No items in this category</p>
              )}
            </div>

            {/* Cart summary */}
            {cart.length > 0 && (
              <div className="bg-muted/50 rounded-xl p-3 space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-2">Order Summary</p>
                {cart.map(c => (
                  <div key={c.id} className="flex items-center justify-between">
                    <span className="text-xs text-foreground">×{c.qty} {c.name}</span>
                    {c.price > 0 && <span className="text-xs text-muted-foreground">₹{c.price * c.qty}</span>}
                  </div>
                ))}
                {total > 0 && (
                  <div className="flex items-center justify-between border-t border-border pt-1.5 mt-1.5">
                    <span className="text-xs font-semibold text-foreground">Total</span>
                    <span className="text-xs font-bold text-primary">₹{total.toLocaleString('en-IN')}</span>
                  </div>
                )}
              </div>
            )}

            <Button
              onClick={submit}
              disabled={!tableId || cart.length === 0}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold h-11"
            >
              Place Order
            </Button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/orders/TakeOrderDrawer.tsx
git commit -m "feat(dashboard): TakeOrderDrawer for manual order entry"
```

---

### Task 7: Smoke test the orders page

- [ ] **Step 1: Start the dashboard dev server**

```bash
npm run dev
```

- [ ] **Step 2: Log in as manager and navigate to `/dashboard/orders`**

Expected:
- Three swimlane columns: Pending / Acknowledged / Served
- "Live Orders" heading with "Updates in real-time" sub-text
- "+ New Order" button top-right
- Empty state messages if no orders today

- [ ] **Step 3: Test "+ New Order" drawer**

- Click "+ New Order"
- Select a table (e.g. "Terrace-1")
- Switch between "Today's Catch" and category tabs
- Add items → see summary appear
- Click "Place Order" → new card appears in Pending column

- [ ] **Step 4: Test Realtime**

Open `menu.sanadige.in/T1` in another browser tab, place an order → confirm the card appears in the Pending column on the dashboard without a page refresh.

- [ ] **Step 5: Test status transitions**

Click "Acknowledge" on a pending order → card moves to Acknowledged column.
Click "Mark Served" on an acknowledged order → card moves to Served column.

- [ ] **Step 6: Test waiter role**

Add a waiter staff member in Supabase (`staff` table, role = `waiter`), log in as them, confirm they see only "Bookings" and "Live Orders" in the sidebar, and can access the New Order drawer.

- [ ] **Step 7: Commit final integration**

```bash
git add .
git commit -m "feat(dashboard): complete Live Orders page with Realtime and take-order"
```
