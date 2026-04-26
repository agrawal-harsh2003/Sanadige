'use client'
import { useState, useTransition } from 'react'
import { assignTableToBooking } from '@/actions/tables'
import { WalkInDrawer } from '@/components/bookings/WalkInDrawer'
import type { TableWithStatus } from '@/app/dashboard/floor/page'

const FLOOR_LABEL: Record<string, string> = {
  terrace: 'Terrace', floor1: 'Floor 1', floor2: 'Floor 2', private: 'Private',
}
const FLOOR_ORDER = ['terrace', 'floor1', 'floor2', 'private']

const STATUS_STYLE: Record<string, string> = {
  available: 'bg-emerald-50 border-emerald-300 hover:bg-emerald-100',
  upcoming:  'bg-amber-50  border-amber-300  hover:bg-amber-100',
  occupied:  'bg-primary/10 border-primary/40 hover:bg-primary/15',
  cleaning:  'bg-muted/60  border-muted-foreground/20 opacity-60',
}
const STATUS_DOT: Record<string, string> = {
  available: 'bg-emerald-500',
  upcoming:  'bg-amber-400',
  occupied:  'bg-primary',
  cleaning:  'bg-muted-foreground/40',
}

function formatTime(iso: string) {
  const d = new Date(iso)
  const ist = new Date(d.getTime() + 5.5 * 60 * 60 * 1000)
  const h = ist.getUTCHours(), m = ist.getUTCMinutes()
  return `${h % 12 || 12}:${m.toString().padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}

interface Props {
  tables: TableWithStatus[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  needsTable: any[]
}

export function FloorMap({ tables, needsTable }: Props) {
  const [selected, setSelected] = useState<TableWithStatus | null>(null)
  const [assignTarget, setAssignTarget] = useState<string | null>(null) // booking id
  const [, startTransition] = useTransition()

  const byFloor = FLOOR_ORDER.reduce<Record<string, TableWithStatus[]>>((acc, f) => {
    acc[f] = tables.filter(t => t.floor === f)
    return acc
  }, {})

  function handleTableClick(table: TableWithStatus) {
    if (table.status === 'cleaning') return
    if (assignTarget && table.status === 'available') {
      startTransition(async () => {
        await assignTableToBooking(assignTarget, table.id)
        setAssignTarget(null)
        setSelected(null)
      })
      return
    }
    setSelected(selected?.id === table.id ? null : table)
  }

  return (
    <div className="space-y-6">
      {/* Assign mode banner */}
      {assignTarget && (
        <div className="bg-primary/10 border border-primary/30 rounded-xl px-4 py-3 flex items-center justify-between">
          <p className="text-sm font-medium text-primary">Tap an <strong>available</strong> table to seat the guest</p>
          <button onClick={() => setAssignTarget(null)} className="text-sm text-muted-foreground hover:text-foreground">Cancel</button>
        </div>
      )}

      {/* Needs-table panel */}
      {needsTable.length > 0 && !assignTarget && (
        <div className="bg-card shadow-sm ring-1 ring-black/5 rounded-2xl p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground mb-3">Checked In — Awaiting Table</p>
          <div className="flex flex-wrap gap-2">
            {needsTable.map((b: any) => (
              <button
                key={b.id}
                onClick={() => setAssignTarget(b.id)}
                className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 hover:bg-blue-100 transition-colors"
              >
                <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                <span className="text-sm font-medium text-blue-800">{b.guest_name}</span>
                <span className="text-xs text-blue-600">{b.party_size}p · {formatTime(b.datetime)}</span>
                <span className="text-xs bg-blue-200 text-blue-800 px-1.5 py-0.5 rounded-full font-semibold">Assign table →</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Walk-in button */}
      <div className="flex justify-end">
        <WalkInDrawer />
      </div>

      {/* Floor sections */}
      {FLOOR_ORDER.filter(f => byFloor[f]?.length).map(floor => (
        <div key={floor} className="bg-card shadow-sm ring-1 ring-black/5 rounded-2xl p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground mb-4">{FLOOR_LABEL[floor]}</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {byFloor[floor].map(table => (
              <button
                key={table.id}
                onClick={() => handleTableClick(table)}
                disabled={table.status === 'cleaning'}
                className={`relative border-2 rounded-xl p-3 text-left transition-all cursor-pointer disabled:cursor-default ${STATUS_STYLE[table.status]} ${
                  selected?.id === table.id ? 'ring-2 ring-primary ring-offset-1' : ''
                } ${assignTarget && table.status !== 'available' ? 'opacity-40' : ''}`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-sm text-foreground">{table.table_number}</span>
                  <span className={`w-2 h-2 rounded-full ${STATUS_DOT[table.status]}`} />
                </div>
                <span className="text-[10px] text-muted-foreground">{table.capacity} seats</span>
                {table.booking && (
                  <div className="mt-1.5 pt-1.5 border-t border-current/10">
                    <p className="text-[10px] font-semibold text-foreground truncate">{table.booking.guest_name}</p>
                    <p className="text-[10px] text-muted-foreground">{table.booking.party_size}p · {formatTime(table.booking.datetime)}</p>
                  </div>
                )}
              </button>
            ))}
          </div>

          {/* Selected table detail */}
          {selected && selected.floor === floor && (
            <div className="mt-4 p-4 bg-muted/30 rounded-xl border border-border">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-foreground">Table {selected.table_number} · {selected.capacity} seats</p>
                  {selected.booking ? (
                    <div className="mt-1 text-sm text-muted-foreground space-y-0.5">
                      <p>Guest: <span className="text-foreground font-medium">{selected.booking.guest_name}</span></p>
                      <p>Party: {selected.booking.party_size} · Time: {formatTime(selected.booking.datetime)}</p>
                      <p>Ref: {selected.booking.booking_ref}</p>
                    </div>
                  ) : (
                    <p className="text-sm text-emerald-600 mt-1">Available</p>
                  )}
                </div>
                <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground text-lg">×</button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
