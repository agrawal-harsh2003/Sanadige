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
              { color: 'bg-amber-400',   label: 'Upcoming' },
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
