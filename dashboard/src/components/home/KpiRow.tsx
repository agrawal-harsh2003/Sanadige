interface KpiCardProps { label: string; value: string; sub?: string }

function KpiCard({ label, value, sub }: KpiCardProps) {
  return (
    <div className="bg-surface border border-border rounded-xl p-5">
      <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-2">{label}</p>
      <p className="text-3xl font-bold text-[#1a2e1a]">{value}</p>
      {sub && <p className="text-xs text-text-muted mt-1">{sub}</p>}
    </div>
  )
}

interface KpiData {
  todayBookings: number
  availableSeats: number
  catchLive: string
  revenueToday: string
}

export function KpiRow({ data }: { data: KpiData }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <KpiCard label="Today's Bookings" value={String(data.todayBookings)} />
      <KpiCard label="Available Seats" value={String(data.availableSeats)} sub="of 142 total" />
      <KpiCard label="Catch Live" value={data.catchLive} />
      <KpiCard label="Revenue Today" value={data.revenueToday} sub="estimated" />
    </div>
  )
}
