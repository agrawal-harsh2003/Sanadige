'use client'
import React, { useState, useTransition, useEffect } from 'react'
import { updateBookingStatus } from '@/actions/bookings'
import { getClientDb } from '@/lib/firebase-client'
import { collection, query, where, onSnapshot } from 'firebase/firestore'
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
  terrace: 'Terrace', floor1: 'Floor 1', floor2: 'Floor 2', private: 'Private',
}
const FLOOR_BADGE: Record<string, string> = {
  terrace: 'bg-amber-50 text-amber-800 ring-1 ring-amber-200',
  floor1:  'bg-primary/10 text-primary ring-1 ring-primary/20',
  floor2:  'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200',
  private: 'bg-rose-50 text-rose-800 ring-1 ring-rose-200',
}
const STATUS_BADGE: Record<string, string> = {
  pending:    'bg-muted text-muted-foreground',
  confirmed:  'bg-primary/10 text-primary ring-1 ring-primary/20',
  checked_in: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
  seated:     'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200',
  completed:  'bg-emerald-100 text-emerald-900',
  no_show:    'bg-muted text-muted-foreground',
  cancelled:  'bg-rose-50 text-rose-700 ring-1 ring-rose-200',
  waitlisted: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
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

  return (
    <div className="bg-card shadow-sm ring-1 ring-black/5 rounded-2xl overflow-hidden">
      <div className="flex items-center justify-end gap-1.5 px-4 py-2 border-b border-border bg-muted/20">
        <span className={`w-1.5 h-1.5 rounded-full ${live ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground/40'}`} />
        <span className="text-[10px] text-muted-foreground font-medium">{live ? 'Live' : 'Connecting\u2026'}</span>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            {['Time', 'Guest', 'Party', 'Floor', 'Occasion', 'Status', 'Actions'].map(h => (
              <th key={h} className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((b, i) => (
            <React.Fragment key={b.id}>
              <tr className={`border-b border-border hover:bg-muted/30 cursor-pointer transition-colors ${i % 2 === 0 ? '' : 'bg-muted/10'}`}
                onClick={() => setExpanded(expanded === b.id ? null : b.id)}>
                <td className="px-4 py-3 font-semibold text-foreground">{formatIST(b.datetime)}</td>
                <td className="px-4 py-3 font-medium text-foreground">{b.guest_name}</td>
                <td className="px-4 py-3 text-foreground">{b.party_size}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${FLOOR_BADGE[b.floor] ?? 'bg-muted text-muted-foreground'}`}>{FLOOR_LABEL[b.floor] ?? b.floor}</span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{b.occasion ?? '\u2014'}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_BADGE[b.status] ?? 'bg-muted text-muted-foreground'}`}>{STATUS_LABEL[b.status] ?? b.status}</span>
                </td>
                <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                  <div className="flex gap-2 flex-wrap">
                    {b.status === 'confirmed' && <Button size="sm" variant="outline" onClick={() => transition(b.id, 'checked_in')} className="text-xs border-blue-200 text-blue-700 hover:bg-blue-50">Check In</Button>}
                    {b.status === 'checked_in' && <Button size="sm" variant="outline" onClick={() => transition(b.id, 'seated')} className="text-xs border-primary/30 text-primary hover:bg-primary/5">Seat</Button>}
                    {b.status === 'seated' && <Button size="sm" variant="outline" onClick={() => transition(b.id, 'completed')} className="text-xs border-emerald-200 text-emerald-700 hover:bg-emerald-50">Complete</Button>}
                    {(b.status === 'confirmed' || b.status === 'checked_in' || b.status === 'seated') && (
                      <Button size="sm" variant="outline" onClick={() => { if (confirm('Cancel this booking?')) transition(b.id, 'cancelled') }} className="text-xs text-rose-600 border-rose-200 hover:bg-rose-50">Cancel</Button>
                    )}
                  </div>
                </td>
              </tr>
              {expanded === b.id && (
                <tr className="bg-muted/20">
                  <td colSpan={7} className="px-6 py-4 space-y-1.5">
                    <p className="text-sm text-foreground"><span className="font-medium text-muted-foreground">Ref:</span> {b.booking_ref}</p>
                    <p className="text-sm text-foreground"><span className="font-medium text-muted-foreground">Phone:</span> {b.phone}</p>
                    {b.channel && <p className="text-sm text-foreground"><span className="font-medium text-muted-foreground">Channel:</span> {b.channel}</p>}
                    {b.special_notes && <p className="text-sm text-foreground"><span className="font-medium text-muted-foreground">Notes:</span> {b.special_notes}</p>}
                    <a href={`https://wa.me/${b.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="text-xs text-primary underline hover:text-accent transition-colors">Open WhatsApp \u2192</a>
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
          {rows.length === 0 && <tr><td colSpan={7} className="px-4 py-16 text-center text-muted-foreground">No bookings found</td></tr>}
        </tbody>
      </table>
    </div>
  )
}
