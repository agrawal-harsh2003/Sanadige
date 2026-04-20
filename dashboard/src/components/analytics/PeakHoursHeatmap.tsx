import React from 'react'

const HOURS = Array.from({ length: 12 }, (_, i) => i + 12)
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

interface HeatmapProps {
  data: Record<string, Record<number, number>>
  maxCount: number
}

export function PeakHoursHeatmap({ data, maxCount }: HeatmapProps) {
  return (
    <div className="bg-card shadow-sm ring-1 ring-black/5 rounded-2xl p-5">
      <p className="text-sm font-semibold text-foreground mb-4">Peak Hours</p>
      <div className="overflow-x-auto">
        <div className="inline-grid gap-[3px]" style={{ gridTemplateColumns: `40px repeat(${HOURS.length}, 36px)` }}>
          <div />
          {HOURS.map(h => (
            <div key={h} className="text-center text-[10px] text-muted-foreground">{h}:00</div>
          ))}
          {DAYS.map(day => (
            <React.Fragment key={day}>
              <div className="text-[10px] text-muted-foreground flex items-center">{day}</div>
              {HOURS.map(h => {
                const count = data[day]?.[h] ?? 0
                const intensity = maxCount > 0 ? count / maxCount : 0
                return (
                  <div
                    key={`${day}-${h}`}
                    title={`${day} ${h}:00 — ${count} bookings`}
                    className="rounded"
                    style={{ height: 28, background: `rgba(26, 58, 42, ${0.08 + intensity * 0.85})` }}
                  />
                )
              })}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  )
}
