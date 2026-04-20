import Link from 'next/link'

const FLOOR_LABEL: Record<string, string> = {
  terrace: 'Terrace', floor1: 'Floor 1', floor2: 'Floor 2', private: 'Private',
}

const FLOOR_COLORS: Record<string, string> = {
  terrace: 'bg-amber-50 text-amber-800 ring-1 ring-amber-200',
  floor1: 'bg-primary/10 text-primary ring-1 ring-primary/20',
  floor2: 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200',
  private: 'bg-rose-50 text-rose-800 ring-1 ring-rose-200',
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
    <div className="bg-card shadow-sm ring-1 ring-black/5 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-semibold text-foreground">Upcoming Bookings</p>
        <Link href="/dashboard/bookings" className="text-xs text-accent hover:underline font-medium">View all →</Link>
      </div>
      <div className="space-y-3">
        {bookings.map(b => (
          <div key={b.id} className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-primary w-16">
                {new Date(b.datetime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
              </span>
              <span className="text-sm font-medium text-foreground">{b.guest_name}</span>
              <span className="text-xs text-muted-foreground">×{b.party_size}</span>
            </div>
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${FLOOR_COLORS[b.floor] ?? 'bg-muted text-muted-foreground'}`}>
              {FLOOR_LABEL[b.floor] ?? b.floor}
            </span>
          </div>
        ))}
        {bookings.length === 0 && <p className="text-sm text-muted-foreground">No upcoming bookings</p>}
      </div>
    </div>
  )
}
