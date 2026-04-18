import Link from 'next/link'

const FLOOR_COLORS: Record<string, string> = {
  terrace: 'bg-amber-100 text-amber-800',
  floor1: 'bg-blue-100 text-blue-800',
  floor2: 'bg-green-100 text-green-800',
  private: 'bg-pink-100 text-pink-800',
}

interface Booking {
  id: string
  datetime: string
  guest_name: string
  party_size: number
  floor: string
}

export function UpcomingBookings({ bookings }: { bookings: Booking[] }) {
  return (
    <div className="bg-surface border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-semibold text-[#1a2e1a]">Upcoming Bookings</p>
        <Link href="/dashboard/bookings" className="text-xs text-[#c8956c] hover:underline">View all →</Link>
      </div>
      <div className="space-y-3">
        {bookings.map(b => (
          <div key={b.id} className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm text-text-muted w-16">
                {new Date(b.datetime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
              </span>
              <span className="text-sm font-medium text-[#1a2e1a]">{b.guest_name}</span>
              <span className="text-xs text-text-muted">×{b.party_size}</span>
            </div>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${FLOOR_COLORS[b.floor] ?? ''}`}>
              {b.floor}
            </span>
          </div>
        ))}
        {bookings.length === 0 && <p className="text-sm text-text-muted">No upcoming bookings</p>}
      </div>
    </div>
  )
}
