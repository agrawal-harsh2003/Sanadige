'use client'
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'

const COLORS = ['#f59e0b', '#3b82f6', '#22c55e', '#ec4899']
const FLOOR_LABELS: Record<string, string> = {
  terrace: 'Terrace', floor1: 'Floor 1', floor2: 'Floor 2', private: 'Private',
}

interface FloorData { floor: string; count: number }

export function FloorDonut({ data }: { data: FloorData[] }) {
  const chartData = data.map(d => ({ name: FLOOR_LABELS[d.floor] ?? d.floor, value: d.count }))
  return (
    <div className="bg-card shadow-sm ring-1 ring-black/5 rounded-2xl p-5">
      <p className="text-sm font-semibold text-foreground mb-4">Popular Floors</p>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie data={chartData} dataKey="value" innerRadius={50} outerRadius={80} paddingAngle={3}>
            {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
