'use client'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

interface DayData { day: string; count: number }

export function BookingsTrend({ data }: { data: DayData[] }) {
  return (
    <div className="bg-card shadow-sm ring-1 ring-black/5 rounded-2xl p-5">
      <p className="text-sm font-semibold text-foreground mb-4">Bookings Trend</p>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e8e3dc" />
          <XAxis dataKey="day" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip />
          <Bar dataKey="count" fill="#1a3a2a" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
