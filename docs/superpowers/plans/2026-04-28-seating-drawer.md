# Seating Drawer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a host clicks "Check In" on a confirmed booking, the booking moves to `checked_in` and a table-picker drawer opens so the host can assign a table — moving the booking straight to `seated`.

**Architecture:** A new `SeatingDrawer` client component subscribes to Firestore (tables + today's bookings) to compute live table availability, renders floor tabs with a table grid, and calls `assignTableToBooking()` on selection. `BookingsTable` gains a `seatTarget` state; the Check In button sets status then opens the drawer, and the Seat button (for already-checked-in guests) also opens it instead of blindly transitioning.

**Tech Stack:** Next.js 14 App Router, React client components, Firebase Firestore (onSnapshot), Tailwind CSS, `assignTableToBooking` server action from `actions/tables.ts`.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `dashboard/src/components/bookings/SeatingDrawer.tsx` | **Create** | Full-screen modal overlay with floor tabs, live table grid, availability colours |
| `dashboard/src/components/bookings/BookingsTable.tsx` | **Modify** | Add `seatTarget` state; Check In opens drawer; Seat button opens drawer |

---

### Task 1: Create SeatingDrawer component

**Files:**
- Create: `dashboard/src/components/bookings/SeatingDrawer.tsx`

- [ ] **Step 1: Write the file**

```tsx
'use client'
import { useState, useEffect } from 'react'
import { getClientDb } from '@/lib/firebase-client'
import { collection, query, where, onSnapshot } from 'firebase/firestore'
import { assignTableToBooking } from '@/actions/tables'

const FLOOR_ORDER = ['terrace', 'floor1', 'floor2', 'private']
const FLOOR_LABEL: Record<string, string> = {
  terrace: 'Terrace', floor1: 'Floor 1', floor2: 'Floor 2', private: 'Private',
}

interface Table {
  id: string
  floor: string
  table_number: string
  capacity: number
  is_active: boolean
}

interface BookingRecord {
  id: string
  table_id?: string
  floor: string
  status: string
  datetime: string
  completed_at?: string
}

type TableStatus = 'available' | 'upcoming' | 'occupied' | 'cleaning'

interface TableWithStatus extends Table {
  tableStatus: TableStatus
}

function getTableStatus(table: Table, bookings: BookingRecord[], now: Date): TableStatus {
  const tableBookings = bookings.filter(b => b.table_id === table.id)
  if (tableBookings.find(b => ['checked_in', 'seated'].includes(b.status))) return 'occupied'
  const recentlyCompleted = tableBookings.find(b => {
    if (b.status !== 'completed' || !b.completed_at) return false
    return now.getTime() - new Date(b.completed_at).getTime() < 15 * 60 * 1000
  })
  if (recentlyCompleted) return 'cleaning'
  const upcoming = bookings.find(b => {
    if (b.status !== 'confirmed') return false
    if (b.table_id && b.table_id !== table.id) return false
    if (!b.table_id && b.floor !== table.floor) return false
    const diff = new Date(b.datetime).getTime() - now.getTime()
    return diff > 0 && diff <= 60 * 60 * 1000
  })
  if (upcoming) return 'upcoming'
  return 'available'
}

const STATUS_STYLE: Record<TableStatus, string> = {
  available: 'bg-emerald-50 border-emerald-300 hover:bg-emerald-100',
  upcoming:  'bg-amber-50  border-amber-300  hover:bg-amber-100',
  occupied:  'bg-primary/10 border-primary/40',
  cleaning:  'bg-muted/60  border-muted-foreground/20',
}
const STATUS_DOT: Record<TableStatus, string> = {
  available: 'bg-emerald-500',
  upcoming:  'bg-amber-400',
  occupied:  'bg-primary',
  cleaning:  'bg-muted-foreground/40',
}

export interface SeatTargetBooking {
  id: string
  guest_name: string
  party_size: number
  floor: string
  booking_ref: string
}

interface Props {
  booking: SeatTargetBooking | null
  onClose: () => void
}

export function SeatingDrawer({ booking, onClose }: Props) {
  const [activeFloor, setActiveFloor] = useState(booking?.floor ?? 'terrace')
  const [tables, setTables] = useState<Table[]>([])
  const [bookings, setBookings] = useState<BookingRecord[]>([])
  const [assigning, setAssigning] = useState(false)

  useEffect(() => {
    if (booking) setActiveFloor(booking.floor)
  }, [booking?.id])

  useEffect(() => {
    if (!booking) return
    const db = getClientDb()
    const unsub = onSnapshot(
      query(collection(db, 'tables'), where('is_active', '==', true)),
      snap => setTables(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Table))
    )
    return unsub
  }, [!!booking])

  useEffect(() => {
    if (!booking) return
    const db = getClientDb()
    const istNow = new Date(Date.now() + 5.5 * 60 * 60 * 1000)
    const today = istNow.toISOString().split('T')[0]
    const unsub = onSnapshot(
      query(
        collection(db, 'bookings'),
        where('datetime', '>=', `${today}T00:00:00+05:30`),
        where('datetime', '<=', `${today}T23:59:59+05:30`),
        where('status', 'in', ['confirmed', 'checked_in', 'seated', 'completed'])
      ),
      snap => setBookings(snap.docs.map(d => ({ id: d.id, ...d.data() }) as BookingRecord))
    )
    return unsub
  }, [!!booking])

  if (!booking) return null

  const now = new Date(Date.now() + 5.5 * 60 * 60 * 1000)
  const floorTables: TableWithStatus[] = tables
    .filter(t => t.floor === activeFloor)
    .map(t => ({ ...t, tableStatus: getTableStatus(t, bookings, now) }))

  async function handleTableClick(table: TableWithStatus) {
    if (assigning) return
    if (table.tableStatus === 'occupied' || table.tableStatus === 'cleaning') return
    if (table.capacity < booking!.party_size) return
    setAssigning(true)
    try {
      await assignTableToBooking(booking!.id, table.id)
      onClose()
    } finally {
      setAssigning(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card w-full sm:max-w-2xl sm:rounded-2xl rounded-t-2xl shadow-2xl ring-1 ring-black/10 max-h-[85vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div>
            <p className="font-cormorant text-xl font-semibold text-foreground">Assign Table</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {booking.guest_name} · {booking.party_size} guests · {booking.booking_ref}
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-2xl leading-none">×</button>
        </div>

        {/* Floor tabs */}
        <div className="flex border-b border-border px-6 shrink-0 overflow-x-auto">
          {FLOOR_ORDER.map(f => (
            <button
              key={f}
              onClick={() => setActiveFloor(f)}
              className={`text-xs font-semibold uppercase tracking-[0.12em] py-3 px-3 border-b-2 whitespace-nowrap transition-colors ${
                activeFloor === f
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {FLOOR_LABEL[f]}
            </button>
          ))}
        </div>

        {/* Table grid */}
        <div className="overflow-y-auto p-6">
          {floorTables.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No tables on this floor</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {floorTables.map(table => {
                const tooSmall = table.capacity < booking.party_size
                const disabled = table.tableStatus === 'occupied' || table.tableStatus === 'cleaning' || tooSmall
                return (
                  <button
                    key={table.id}
                    onClick={() => handleTableClick(table)}
                    disabled={disabled || assigning}
                    className={`relative border-2 rounded-xl p-3 text-left transition-all ${
                      disabled
                        ? 'opacity-40 cursor-not-allowed bg-muted/40 border-muted-foreground/20'
                        : `cursor-pointer ${STATUS_STYLE[table.tableStatus]}`
                    } ${assigning ? 'pointer-events-none' : ''}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-sm text-foreground">{table.table_number}</span>
                      <span className={`w-2 h-2 rounded-full ${STATUS_DOT[table.tableStatus]}`} />
                    </div>
                    <span className="text-[10px] text-muted-foreground">{table.capacity} seats</span>
                    {tooSmall && (
                      <p className="text-[9px] text-rose-500 mt-0.5">Too small</p>
                    )}
                  </button>
                )
              })}
            </div>
          )}

          {/* Legend */}
          <div className="flex gap-4 mt-5 pt-4 border-t border-border">
            {[
              { color: 'bg-emerald-500', label: 'Available' },
              { color: 'bg-amber-400',   label: 'Upcoming (booking due soon)' },
              { color: 'bg-primary',     label: 'Occupied' },
            ].map(l => (
              <span key={l.label} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <span className={`w-2 h-2 rounded-full shrink-0 ${l.color}`} />
                {l.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd dashboard && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors referencing `SeatingDrawer.tsx`.

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/components/bookings/SeatingDrawer.tsx
git commit -m "feat: add SeatingDrawer component with live floor table picker"
```

---

### Task 2: Wire SeatingDrawer into BookingsTable

**Files:**
- Modify: `dashboard/src/components/bookings/BookingsTable.tsx`

The change is:
1. Import `SeatingDrawer` and `SeatTargetBooking`.
2. Add `seatTarget` state (`SeatTargetBooking | null`).
3. Check In click: call `updateBookingStatus(id, 'checked_in')` then `setSeatTarget(booking)`.
4. Seat button (for `checked_in` bookings): open drawer instead of calling `transition(id, 'seated')`.
5. Render `<SeatingDrawer>` at the bottom of the component.

- [ ] **Step 1: Replace BookingsTable.tsx with the updated version**

```tsx
'use client'
import React, { useState, useTransition, useEffect } from 'react'
import { updateBookingStatus } from '@/actions/bookings'
import { getClientDb } from '@/lib/firebase-client'
import { collection, query, where, onSnapshot } from 'firebase/firestore'
import { Button } from '@/components/ui/button'
import { SeatingDrawer } from '@/components/bookings/SeatingDrawer'
import type { SeatTargetBooking } from '@/components/bookings/SeatingDrawer'

function formatIST(datetime: string) {
  const d = new Date(datetime)
  const ist = new Date(d.getTime() + 5.5 * 60 * 60 * 1000)
  const h = ist.getUTCHours()
  const m = ist.getUTCMinutes()
  const period = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return `${hour.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} ${period}`
}

const FLOOR_LABEL: Record<string, string> = {
  terrace: 'Terrace', floor1: 'Floor 1', floor2: 'Floor 2', private: 'Private',
}
const FLOOR_BADGE: Record<string, string> = {
  terrace: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200/80',
  floor1:  'bg-primary/8 text-primary ring-1 ring-primary/15',
  floor2:  'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/80',
  private: 'bg-accent/8 text-accent ring-1 ring-accent/20',
}
const STATUS_BADGE: Record<string, string> = {
  pending:    'bg-muted/80 text-muted-foreground',
  confirmed:  'bg-primary/8 text-primary ring-1 ring-primary/15',
  checked_in: 'bg-sky-50 text-sky-700 ring-1 ring-sky-200/80',
  seated:     'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/80',
  completed:  'bg-emerald-100/80 text-emerald-800 ring-1 ring-emerald-200/60',
  no_show:    'bg-muted/60 text-muted-foreground line-through',
  cancelled:  'bg-rose-50 text-rose-600 ring-1 ring-rose-200/80',
  waitlisted: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200/80',
}
const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending', confirmed: 'Confirmed', checked_in: 'Checked In',
  seated: 'Seated', completed: 'Completed', no_show: 'No Show',
  cancelled: 'Cancelled', waitlisted: 'Waitlisted',
}

interface Booking {
  id: string; booking_ref: string; guest_name: string; phone: string
  party_size: number; datetime: string; floor: string
  special_notes: string | null; occasion: string | null
  status: string; channel: string | null; table_id: string | null
}

export function BookingsTable({ bookings, date }: { bookings: Booking[]; date: string }) {
  const [rows, setRows] = useState<Booking[]>(bookings)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [, startTransition] = useTransition()
  const [live, setLive] = useState(false)
  const [seatTarget, setSeatTarget] = useState<SeatTargetBooking | null>(null)

  useEffect(() => { setRows(bookings) }, [bookings])

  useEffect(() => {
    const db = getClientDb()
    const q = query(
      collection(db, 'bookings'),
      where('datetime', '>=', `${date}T00:00:00+05:30`),
      where('datetime', '<=', `${date}T23:59:59+05:30`)
    )
    setLive(false)
    const unsub = onSnapshot(q,
      (snap) => {
        setLive(true)
        const updated = snap.docs.map(d => ({ id: d.id, ...d.data() }) as Booking)
        setRows(updated.sort((a, b) => a.datetime.localeCompare(b.datetime)))
      },
      () => setLive(false)
    )
    return () => unsub()
  }, [date])

  function transition(id: string, status: Parameters<typeof updateBookingStatus>[1]) {
    startTransition(() => updateBookingStatus(id, status))
  }

  function handleCheckIn(b: Booking) {
    startTransition(async () => {
      await updateBookingStatus(b.id, 'checked_in')
      setSeatTarget({ id: b.id, guest_name: b.guest_name, party_size: b.party_size, floor: b.floor, booking_ref: b.booking_ref })
    })
  }

  function handleSeat(b: Booking) {
    setSeatTarget({ id: b.id, guest_name: b.guest_name, party_size: b.party_size, floor: b.floor, booking_ref: b.booking_ref })
  }

  return (
    <>
      <div className="bg-card shadow-sm ring-1 ring-black/[0.04] rounded-2xl overflow-hidden">
        <div className="flex items-center justify-end gap-1.5 px-4 py-2 border-b border-border bg-muted/20">
          <span className={`w-1.5 h-1.5 rounded-full ${live ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground/30'}`} />
          <span className="text-[10px] text-muted-foreground font-medium">{live ? 'Live' : 'Connecting\u2026'}</span>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              {['Time', 'Guest', 'Party', 'Floor', 'Occasion', 'Status', 'Actions'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/80">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((b, i) => (
              <React.Fragment key={b.id}>
                <tr className={`border-b border-border/60 hover:bg-muted/20 cursor-pointer transition-colors ${i % 2 === 0 ? '' : 'bg-muted/[0.04]'}`}
                  onClick={() => setExpanded(expanded === b.id ? null : b.id)}>
                  <td className="px-4 py-3 font-cormorant text-[17px] font-semibold text-primary leading-none">{formatIST(b.datetime)}</td>
                  <td className="px-4 py-3 font-medium text-[13px] text-foreground">{b.guest_name}</td>
                  <td className="px-4 py-3 text-[13px] text-foreground">{b.party_size}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${FLOOR_BADGE[b.floor] ?? 'bg-muted text-muted-foreground'}`}>{FLOOR_LABEL[b.floor] ?? b.floor}</span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{b.occasion ?? '\u2014'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_BADGE[b.status] ?? 'bg-muted text-muted-foreground'}`}>{STATUS_LABEL[b.status] ?? b.status}</span>
                  </td>
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <div className="flex gap-2 flex-wrap">
                      {b.status === 'confirmed' && (
                        <Button size="sm" variant="outline" onClick={() => handleCheckIn(b)} className="text-xs border-blue-200 text-blue-700 hover:bg-blue-50">Check In</Button>
                      )}
                      {b.status === 'checked_in' && (
                        <Button size="sm" variant="outline" onClick={() => handleSeat(b)} className="text-xs border-primary/30 text-primary hover:bg-primary/5">Seat</Button>
                      )}
                      {b.status === 'seated' && (
                        <Button size="sm" variant="outline" onClick={() => transition(b.id, 'completed')} className="text-xs border-emerald-200 text-emerald-700 hover:bg-emerald-50">Complete</Button>
                      )}
                      {(b.status === 'confirmed' || b.status === 'checked_in' || b.status === 'seated') && (
                        <Button size="sm" variant="outline" onClick={() => { if (confirm('Cancel this booking?')) transition(b.id, 'cancelled') }} className="text-xs text-rose-600 border-rose-200 hover:bg-rose-50">Cancel</Button>
                      )}
                    </div>
                  </td>
                </tr>
                {expanded === b.id && (
                  <tr className="bg-muted/[0.06] border-b border-border/60">
                    <td colSpan={7} className="px-6 py-4">
                      <div className="flex flex-wrap gap-x-6 gap-y-1.5 text-[12px]">
                        <span><span className="text-muted-foreground">Ref</span> <span className="font-medium text-foreground">{b.booking_ref}</span></span>
                        <span><span className="text-muted-foreground">Phone</span> <span className="font-medium text-foreground">{b.phone}</span></span>
                        {b.channel && <span><span className="text-muted-foreground">Channel</span> <span className="font-medium text-foreground capitalize">{b.channel}</span></span>}
                        {b.special_notes && <span><span className="text-muted-foreground">Notes</span> <span className="font-medium text-foreground">{b.special_notes}</span></span>}
                      </div>
                      <a href={`https://wa.me/${b.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="inline-block mt-2 text-[11px] text-accent hover:text-accent/80 transition-colors">
                        Open WhatsApp →
                      </a>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
            {rows.length === 0 && <tr><td colSpan={7} className="px-4 py-16 text-center text-muted-foreground">No bookings found</td></tr>}
          </tbody>
        </table>
      </div>

      <SeatingDrawer booking={seatTarget} onClose={() => setSeatTarget(null)} />
    </>
  )
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd dashboard && npx tsc --noEmit 2>&1 | head -30
```

Expected: no output (clean).

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/components/bookings/BookingsTable.tsx
git commit -m "feat: Check In opens SeatingDrawer to assign table; Seat button also opens picker"
```

---

### Task 3: Verify floor map revalidation

`assignTableToBooking` in `dashboard/src/actions/tables.ts` already calls:
- `revalidatePath('/dashboard/floor')`
- `revalidatePath('/dashboard/bookings')`

No changes needed. After assigning a table the floor map page will show the table as occupied on next load.

- [ ] **Step 1: Confirm by reading the action**

```bash
grep -n "revalidatePath" dashboard/src/actions/tables.ts
```

Expected output:
```
56:  revalidatePath('/dashboard/floor')
74:  revalidatePath('/dashboard/floor')
75:  revalidatePath('/dashboard/bookings')
```

- [ ] **Step 2: Deploy to Vercel**

```bash
git push origin main
```

Vercel auto-deploys on push. Check deployment in ~30s at https://vercel.com/innov-tech/sanadige.

- [ ] **Step 3: End-to-end test**

1. Open https://sanadige.vercel.app/dashboard/bookings
2. Find a `confirmed` booking → click **Check In**
3. Drawer appears showing all floors, defaulting to the booking's floor
4. Tables with `capacity < party_size` are greyed with "Too small"
5. Click an available (green) table → drawer closes → booking status = `seated`
6. Navigate to `/dashboard/floor` → that table is now occupied (teal dot)
7. Back in bookings → Seat button on a `checked_in` booking also opens the same drawer
