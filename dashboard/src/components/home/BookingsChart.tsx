'use client'
import { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

interface DayData { day: string; count: number; isToday: boolean }

export function BookingsChart({ weekData, monthData }: { weekData: DayData[]; monthData: DayData[] }) {
  const [view, setView] = useState<'week' | 'month'>('week')
  const data = view === 'week' ? weekData : monthData

  return (
    <div className="bg-card shadow-sm ring-1 ring-black/5 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-semibold text-foreground">Bookings Trend</p>
        <div className="flex gap-1 bg-muted rounded-full p-0.5">
          {(['week', 'month'] as const).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`text-xs px-3 py-1 rounded-full font-medium transition-all ${view === v ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {v === 'week' ? 'Week' : 'Month'}
            </button>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data}>
          <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#6B6355' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: '#6B6355' }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 24px rgba(0,0,0,0.08)', fontSize: 12 }} />
          <Bar dataKey="count" radius={[6, 6, 0, 0]} fill="#1C4A5A" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
