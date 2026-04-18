'use client'
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend } from 'recharts'

interface RevenueData { day: string; revenue: number; ma7: number }

export function RevenueTrend({ data }: { data: RevenueData[] }) {
  return (
    <div className="bg-surface border border-border rounded-xl p-5">
      <p className="text-sm font-semibold text-[#1a2e1a] mb-4">Revenue Trend (estimated)</p>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e8e3dc" />
          <XAxis dataKey="day" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `₹${(v / 1000).toFixed(0)}k`} />
          <Tooltip formatter={(v) => v != null ? `₹${Number(v).toLocaleString('en-IN')}` : ''} />
          <Legend />
          <Line type="monotone" dataKey="revenue" stroke="#1a3a2a" strokeWidth={2} dot={false} name="Revenue" />
          <Line type="monotone" dataKey="ma7" stroke="#c8956c" strokeWidth={2} dot={false} strokeDasharray="4 2" name="7-day MA" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
