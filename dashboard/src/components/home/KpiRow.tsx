import React from 'react'
import { CalendarDays, Users } from 'lucide-react'

const METRICS: { key: string; label: string; icon: React.ElementType; iconClass: string; sub?: string }[] = [
  { key: 'todayBookings', label: "Today's Bookings", icon: CalendarDays, iconClass: 'text-primary' },
  { key: 'availableSeats', label: 'Available Seats', icon: Users, iconClass: 'text-primary', sub: 'of 142 total' },
]

interface KpiData {
  todayBookings: number
  availableSeats: number
}

export function KpiRow({ data }: { data: KpiData }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      {METRICS.map(({ key, label, icon: Icon, iconClass, sub }) => (
        <div key={key} className="bg-card shadow-sm ring-1 ring-black/5 rounded-2xl p-5">
          <div className="flex items-start justify-between mb-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">{label}</p>
            <Icon size={16} className={iconClass} strokeWidth={1.8} />
          </div>
          <p className="text-4xl font-bold text-foreground leading-none">
            {data[key as keyof KpiData]}
          </p>
          {sub && <p className="text-xs text-muted-foreground mt-2">{sub}</p>}
        </div>
      ))}
    </div>
  )
}
