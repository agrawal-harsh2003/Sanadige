import { getSupabase } from '@/lib/supabase'
import { BookingsTrend } from '@/components/analytics/BookingsTrend'
import { FloorDonut } from '@/components/analytics/FloorDonut'
import { PeakHoursHeatmap } from '@/components/analytics/PeakHoursHeatmap'
import { RevenueTrend } from '@/components/analytics/RevenueTrend'

async function getAnalyticsData() {
  const supabase = getSupabase()
  const from = new Date()
  from.setDate(from.getDate() - 30)

  const { data: bookings } = await supabase
    .from('bookings')
    .select('datetime, floor, party_size, status')
    .gte('datetime', from.toISOString())
    .in('status', ['confirmed', 'seated'])
    .order('datetime')

  const all = bookings ?? []

  // Daily counts for trend
  const byDay: Record<string, number> = {}
  all.forEach(b => {
    const day = b.datetime.split('T')[0]
    byDay[day] = (byDay[day] ?? 0) + 1
  })
  const trendData = Object.entries(byDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, count]) => ({
      day: new Date(day).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
      count,
    }))

  // Floor distribution
  const byFloor: Record<string, number> = {}
  all.forEach(b => { byFloor[b.floor] = (byFloor[b.floor] ?? 0) + 1 })
  const floorData = Object.entries(byFloor).map(([floor, count]) => ({ floor, count }))

  // Peak hours heatmap
  const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const heatmap: Record<string, Record<number, number>> = {}
  all.forEach(b => {
    const d = new Date(b.datetime)
    const dayName = DAY_NAMES[d.getDay()]
    const hour = d.getHours()
    if (!heatmap[dayName]) heatmap[dayName] = {}
    heatmap[dayName][hour] = (heatmap[dayName][hour] ?? 0) + 1
  })
  const maxCount = Math.max(
    ...Object.values(heatmap).flatMap(h => Object.values(h)),
    1
  )

  // Revenue with 7-day MA
  const revenueByDay: Record<string, number> = {}
  all.forEach(b => {
    const day = b.datetime.split('T')[0]
    revenueByDay[day] = (revenueByDay[day] ?? 0) + ((b.party_size ?? 0) * 2000)
  })
  const revDays = Object.entries(revenueByDay).sort(([a], [b]) => a.localeCompare(b))
  const revenueData = revDays.map(([day, revenue], i) => {
    const window = revDays.slice(Math.max(0, i - 6), i + 1)
    const ma7 = Math.round(window.reduce((s, [, v]) => s + v, 0) / window.length)
    return {
      day: new Date(day).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
      revenue,
      ma7,
    }
  })

  return { trendData, floorData, heatmap, maxCount, revenueData }
}

export default async function AnalyticsPage() {
  const data = await getAnalyticsData()
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-foreground">Analytics</h1>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <BookingsTrend data={data.trendData} />
        <FloorDonut data={data.floorData} />
      </div>
      <PeakHoursHeatmap data={data.heatmap} maxCount={data.maxCount} />
      <RevenueTrend data={data.revenueData} />
    </div>
  )
}
