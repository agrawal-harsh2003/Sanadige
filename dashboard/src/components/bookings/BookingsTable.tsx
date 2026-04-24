'use client'
import React from 'react'
import { useState, useTransition } from 'react'
import { updateBookingStatus } from '@/actions/bookings'
import { Button } from '@/components/ui/button'

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
  terrace: 'Terrace',
  floor1: 'Floor 1',
  floor2: 'Floor 2',
  private: 'Private',
}

const FLOOR_BADGE: Record<string, string> = {
  terrace: 'bg-amber-50 text-amber-800 ring-1 ring-amber-200',
  floor1: 'bg-primary/10 text-primary ring-1 ring-primary/20',
  floor2: 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200',
  private: 'bg-rose-50 text-rose-800 ring-1 ring-rose-200',
}

const STATUS_BADGE: Record<string, string> = {
  confirmed: 'bg-primary/10 text-primary ring-1 ring-primary/20',
  seated: 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200',
  no_show: 'bg-muted text-muted-foreground',
  cancelled: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200',
}

const STATUS_LABEL: Record<string, string> = {
  confirmed: 'Confirmed',
  seated: 'Seated',
  no_show: 'No Show',
  cancelled: 'Cancelled',
}

interface Booking {
  id: string
  booking_ref: string
  guest_name: string
  phone: string
  party_size: number
  datetime: string
  floor: string
  special_notes: string | null
  status: string
}

export function BookingsTable({ bookings }: { bookings: Booking[] }) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  function markSeated(id: string) {
    startTransition(() => updateBookingStatus(id, 'seated'))
  }

  function cancel(id: string) {
    if (!confirm('Cancel this booking?')) return
    startTransition(() => updateBookingStatus(id, 'cancelled'))
  }

  return (
    <div className="bg-card shadow-sm ring-1 ring-black/5 rounded-2xl overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            {['Time', 'Guest', 'Party', 'Floor', 'Notes', 'Status', 'Actions'].map(h => (
              <th key={h} className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {bookings.map((b, i) => (
            <React.Fragment key={b.id}>
              <tr
                className={`border-b border-border hover:bg-muted/30 cursor-pointer transition-colors ${i % 2 === 0 ? '' : 'bg-muted/10'}`}
                onClick={() => setExpanded(expanded === b.id ? null : b.id)}
              >
                <td className="px-4 py-3 font-semibold text-foreground">
                  {formatIST(b.datetime)}
                </td>
                <td className="px-4 py-3 font-medium text-foreground">{b.guest_name}</td>
                <td className="px-4 py-3 text-foreground">{b.party_size}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${FLOOR_BADGE[b.floor] ?? 'bg-muted text-muted-foreground'}`}>
                    {FLOOR_LABEL[b.floor] ?? b.floor}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground max-w-[150px] truncate">{b.special_notes ?? '—'}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_BADGE[b.status] ?? 'bg-muted text-muted-foreground'}`}>
                    {STATUS_LABEL[b.status] ?? b.status}
                  </span>
                </td>
                <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                  <div className="flex gap-2">
                    {b.status === 'confirmed' && (
                      <Button size="sm" variant="outline" onClick={() => markSeated(b.id)} className="text-xs border-primary/30 text-primary hover:bg-primary/5">Seat</Button>
                    )}
                    {(b.status === 'confirmed' || b.status === 'seated') && (
                      <Button size="sm" variant="outline" onClick={() => cancel(b.id)} className="text-xs text-rose-600 border-rose-200 hover:bg-rose-50">Cancel</Button>
                    )}
                  </div>
                </td>
              </tr>
              {expanded === b.id && (
                <tr className="bg-muted/20">
                  <td colSpan={7} className="px-6 py-4 space-y-1.5">
                    <p className="text-sm text-foreground"><span className="font-medium text-muted-foreground">Ref:</span> {b.booking_ref}</p>
                    <p className="text-sm text-foreground"><span className="font-medium text-muted-foreground">Phone:</span> {b.phone}</p>
                    {b.special_notes && <p className="text-sm text-foreground"><span className="font-medium text-muted-foreground">Notes:</span> {b.special_notes}</p>}
                    <a
                      href={`https://wa.me/${b.phone.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-primary underline hover:text-accent transition-colors"
                    >
                      Open WhatsApp →
                    </a>
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
          {bookings.length === 0 && (
            <tr><td colSpan={7} className="px-4 py-16 text-center text-muted-foreground">No bookings found</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
