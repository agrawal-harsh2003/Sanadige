'use client'
import { useState, useTransition } from 'react'
import { updateBookingStatus } from '@/actions/bookings'
import { Button } from '@/components/ui/button'

const FLOOR_BADGE: Record<string, string> = {
  terrace: 'bg-amber-100 text-amber-800',
  floor1: 'bg-blue-100 text-blue-800',
  floor2: 'bg-green-100 text-green-800',
  private: 'bg-pink-100 text-pink-800',
}

const STATUS_BADGE: Record<string, string> = {
  confirmed: 'bg-blue-100 text-blue-800',
  seated: 'bg-green-100 text-green-800',
  no_show: 'bg-gray-100 text-gray-600',
  cancelled: 'bg-red-100 text-red-800',
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
    <div className="bg-surface border border-border rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead className="border-b border-border">
          <tr className="text-left">
            {['Time', 'Guest', 'Party', 'Floor', 'Notes', 'Status', 'Actions'].map(h => (
              <th key={h} className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-text-muted">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {bookings.map(b => (
            <>
              <tr
                key={b.id}
                className="border-b border-border hover:bg-background cursor-pointer"
                onClick={() => setExpanded(expanded === b.id ? null : b.id)}
              >
                <td className="px-4 py-3 text-text-muted">
                  {new Date(b.datetime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                </td>
                <td className="px-4 py-3 font-medium text-[#1a2e1a]">{b.guest_name}</td>
                <td className="px-4 py-3 text-[#1a2e1a]">{b.party_size}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${FLOOR_BADGE[b.floor] ?? ''}`}>
                    {b.floor}
                  </span>
                </td>
                <td className="px-4 py-3 text-text-muted max-w-[150px] truncate">{b.special_notes ?? '—'}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_BADGE[b.status] ?? ''}`}>
                    {b.status}
                  </span>
                </td>
                <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                  <div className="flex gap-2">
                    {b.status === 'confirmed' && (
                      <Button size="sm" variant="outline" onClick={() => markSeated(b.id)} className="text-xs">Seat</Button>
                    )}
                    {(b.status === 'confirmed' || b.status === 'seated') && (
                      <Button size="sm" variant="outline" onClick={() => cancel(b.id)} className="text-xs text-red-600 border-red-200">Cancel</Button>
                    )}
                  </div>
                </td>
              </tr>
              {expanded === b.id && (
                <tr key={`${b.id}-detail`} className="bg-background">
                  <td colSpan={7} className="px-6 py-4 text-sm text-[#1a2e1a] space-y-1">
                    <p><span className="font-medium">Ref:</span> {b.booking_ref}</p>
                    <p><span className="font-medium">Phone:</span> {b.phone}</p>
                    {b.special_notes && <p><span className="font-medium">Notes:</span> {b.special_notes}</p>}
                    <a
                      href={`https://wa.me/${b.phone.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#c8956c] underline text-xs"
                    >
                      Open WhatsApp
                    </a>
                  </td>
                </tr>
              )}
            </>
          ))}
          {bookings.length === 0 && (
            <tr><td colSpan={7} className="px-4 py-12 text-center text-text-muted">No bookings found</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
