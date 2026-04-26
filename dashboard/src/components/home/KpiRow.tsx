import React from 'react'
import { CalendarDays, Users, CheckCircle, AlertCircle } from 'lucide-react'

interface KpiData {
  todayBookings: number
  availableSeats: number
  checkedIn: number
  noShows: number
}

const METRICS: { key: keyof KpiData; label: string; icon: React.ElementType; iconClass: string; sub?: string }[] = [
  { key: 'todayBookings', label: 'Active Bookings',     icon: CalendarDays,  iconClass: 'text-primary' },
  { key: 'checkedIn',     label: 'Checked In / Seated', icon: CheckCircle,   iconClass: 'text-emerald-600' },
  { key: 'availableSeats',label: 'Remaining Capacity',  icon: Users,         iconClass: 'text-primary', sub: 'covers available' },
  { key: 'noShows',       label: "Today's No-shows",    icon: AlertCircle,   iconClass: 'text-rose-500' },
]

export function KpiRow({ data }: { data: KpiData }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {METRICS.map(({ key, label, icon: Icon, iconClass, sub }) => (
        <div key={key} className="bg-card shadow-sm ring-1 ring-black/5 rounded-2xl p-5">
          <div className="flex items-start justify-between mb-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">{label}</p>
            <Icon size={16} className={iconClass} strokeWidth={1.8} />
          </div>
          <p className="text-4xl font-bold text-foreground leading-none">{data[key]}</p>
          {sub && <p className="text-xs text-muted-foreground mt-2">{sub}</p>}
        </div>
      ))}
    </div>
  )
}
