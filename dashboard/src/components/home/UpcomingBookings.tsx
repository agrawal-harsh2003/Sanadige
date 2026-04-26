import Link from 'next/link'

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
const FLOOR_DOT: Record<string, string> = {
  terrace: 'bg-amber-400',
  floor1:  'bg-primary',
  floor2:  'bg-emerald-500',
  private: 'bg-rose-400',
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
    <div className="bg-card shadow-sm ring-1 ring-black/[0.04] rounded-2xl p-5">
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-sm font-semibold text-foreground">Upcoming Today</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Confirmed &amp; checked in</p>
        </div>
        <Link href="/dashboard/bookings" className="text-[11px] text-accent hover:text-accent/80 font-medium transition-colors">
          View all →
        </Link>
      </div>
      <div className="divide-y divide-border/60">
        {bookings.map(b => (
          <div key={b.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
            <div className="flex items-center gap-3">
              <p className="font-cormorant text-[17px] font-semibold text-primary leading-none w-[68px] shrink-0">
                {formatIST(b.datetime)}
              </p>
              <div>
                <p className="text-[13px] font-medium text-foreground leading-snug">{b.guest_name}</p>
                <p className="text-[11px] text-muted-foreground">{b.party_size} {b.party_size === 1 ? 'guest' : 'guests'}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className={`w-1.5 h-1.5 rounded-full ${FLOOR_DOT[b.floor] ?? 'bg-muted-foreground'}`} />
              <span className="text-[11px] text-muted-foreground font-medium">{FLOOR_LABEL[b.floor] ?? b.floor}</span>
            </div>
          </div>
        ))}
        {bookings.length === 0 && (
          <p className="text-[13px] text-muted-foreground py-6 text-center">No upcoming bookings today</p>
        )}
      </div>
    </div>
  )
}
