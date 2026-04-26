import React from 'react'
import { CalendarDays, Users, CheckCircle, AlertCircle } from 'lucide-react'

interface KpiData {
  todayBookings: number
  availableSeats: number
  checkedIn: number
  noShows: number
}

const METRICS: {
  key: keyof KpiData
  label: string
  icon: React.ElementType
  iconColor: string
  accent?: boolean
}[] = [
  { key: 'todayBookings',  label: 'Active Bookings',      icon: CalendarDays, iconColor: 'text-primary' },
  { key: 'checkedIn',      label: 'Checked In / Seated',  icon: CheckCircle,  iconColor: 'text-emerald-600' },
  { key: 'availableSeats', label: 'Remaining Capacity',   icon: Users,        iconColor: 'text-primary' },
  { key: 'noShows',        label: "Today's No-shows",     icon: AlertCircle,  iconColor: 'text-rose-500' },
]

export function KpiRow({ data }: { data: KpiData }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {METRICS.map(({ key, label, icon: Icon, iconColor }) => (
        <div key={key} className="bg-card shadow-sm ring-1 ring-black/[0.04] rounded-2xl p-5 group">
          <div className="flex items-start justify-between mb-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground leading-snug max-w-[120px]">
              {label}
            </p>
            <div className="w-8 h-8 rounded-xl bg-muted/60 flex items-center justify-center flex-shrink-0">
              <Icon size={15} className={iconColor} strokeWidth={1.8} />
            </div>
          </div>
          <p className="font-cormorant text-[3rem] font-semibold text-foreground leading-none tracking-tight">
            {data[key]}
          </p>
        </div>
      ))}
    </div>
  )
}
