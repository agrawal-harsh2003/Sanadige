'use client'
import { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

interface DayData { day: string; count: number; isToday: boolean }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-card border border-border rounded-xl shadow-lg px-3 py-2.5">
      <p className="text-[11px] text-muted-foreground font-medium mb-0.5">{label}</p>
      <p className="text-sm font-cormorant font-semibold text-foreground">{payload[0].value} bookings</p>
    </div>
  )
}

export function BookingsChart({ weekData, monthData }: { weekData: DayData[]; monthData: DayData[] }) {
  const [view, setView] = useState<'week' | 'month'>('week')
  const data = view === 'week' ? weekData : monthData

  return (
    <div className="bg-card shadow-sm ring-1 ring-black/[0.04] rounded-2xl p-5">
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-sm font-semibold text-foreground">Bookings Trend</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Confirmed & completed covers</p>
        </div>
        <div className="flex gap-0.5 bg-muted rounded-full p-0.5">
          {(['week', 'month'] as const).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`text-[11px] px-3 py-1 rounded-full font-medium transition-all ${
                view === v ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {v === 'week' ? 'Week' : 'Month'}
            </button>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={172}>
        <BarChart data={data} barSize={view === 'month' ? 6 : 22}>
          <XAxis dataKey="day" tick={{ fontSize: 10, fill: 'oklch(0.52 0.022 65)' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: 'oklch(0.52 0.022 65)' }} axisLine={false} tickLine={false} width={24} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'oklch(0.235 0.052 196 / 0.04)' }} />
          <Bar dataKey="count" radius={[5, 5, 0, 0]}>
            {data.map((d, i) => (
              <Cell
                key={i}
                fill={d.isToday ? 'oklch(0.585 0.135 44)' : 'oklch(0.235 0.052 196)'}
                fillOpacity={d.isToday ? 1 : 0.75}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p className="text-[10px] text-muted-foreground mt-2 text-right">
        <span className="inline-block w-2 h-2 rounded-sm bg-accent align-middle mr-1" />today
        <span className="inline-block w-2 h-2 rounded-sm bg-primary/75 align-middle mx-1 ml-3" />other days
      </p>
    </div>
  )
}
