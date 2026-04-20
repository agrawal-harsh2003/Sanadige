import { getSupabase } from '@/lib/supabase'
import { KpiRow } from '@/components/home/KpiRow'
import { BookingsChart } from '@/components/home/BookingsChart'
import { UpcomingBookings } from '@/components/home/UpcomingBookings'
import { CatchWidget } from '@/components/home/CatchWidget'
import { ActivityFeed } from '@/components/home/ActivityFeed'
import { StaffWidget } from '@/components/home/StaffWidget'

async function getDashboardData() {
  const supabase = getSupabase()
  const today = new Date().toISOString().split('T')[0]
  const todayStart = `${today}T00:00:00`
  const todayEnd = `${today}T23:59:59`

  // For the past 30 days (used for chart + monthly KPIs)
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const [todayBookingsRes, monthBookingsRes, catchRes, staffRes, activityRes] = await Promise.all([
    supabase
      .from('bookings')
      .select('id,datetime,guest_name,party_size,floor,status')
      .gte('datetime', todayStart)
      .lte('datetime', todayEnd)
      .eq('status', 'confirmed')
      .order('datetime'),
    supabase
      .from('bookings')
      .select('datetime,party_size,status')
      .gte('datetime', thirtyDaysAgo.toISOString())
      .in('status', ['confirmed', 'seated'])
      .order('datetime'),
    supabase
      .from('daily_availability')
      .select('id,status,catch_items(id,name)')
      .eq('date', today),
    supabase.from('staff').select('id,name,role'),
    supabase
      .from('activity_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  const todayBookings = todayBookingsRes.data ?? []
  const monthBookings = monthBookingsRes.data ?? []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const catchItems = (catchRes.data ?? []).map((r: any) => ({
    id: r.catch_items?.id ?? r.id,
    name: r.catch_items?.name ?? 'Unknown',
    status: r.status as string,
  }))

  const availableCatch = catchItems.filter(c => c.status === 'available').length
  const catchLive = `${availableCatch}/${catchItems.length}`
  const bookedSeats = todayBookings.reduce((s, b) => s + (b.party_size ?? 0), 0)
  const availableSeats = Math.max(0, 142 - bookedSeats)
  const revenueToday = `₹${(todayBookings.reduce((s, b) => s + (b.party_size ?? 0), 0) * 2000).toLocaleString('en-IN')}`

  // Count bookings per day from monthBookings
  const byDay: Record<string, number> = {}
  monthBookings.forEach(b => {
    const day = b.datetime.split('T')[0]
    byDay[day] = (byDay[day] ?? 0) + 1
  })

  // Last 7 days
  const weekData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    const dateStr = d.toISOString().split('T')[0]
    return {
      day: d.toLocaleDateString('en-IN', { weekday: 'short' }),
      count: byDay[dateStr] ?? 0,
      isToday: dateStr === today,
    }
  })

  // Last 30 days
  const monthData = Array.from({ length: 30 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (29 - i))
    const dateStr = d.toISOString().split('T')[0]
    return {
      day: d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
      count: byDay[dateStr] ?? 0,
      isToday: dateStr === today,
    }
  })

  return {
    kpi: { todayBookings: todayBookings.length, availableSeats, catchLive, revenueToday },
    upcoming: todayBookings.slice(0, 5),
    catchItems,
    staff: staffRes.data ?? [],
    activities: activityRes.data ?? [],
    weekData,
    monthData,
  }
}

export async function MissionControl() {
  const data = await getDashboardData()

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-foreground">Mission Control</h1>
      <KpiRow data={data.kpi} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <BookingsChart weekData={data.weekData} monthData={data.monthData} />
        <UpcomingBookings bookings={data.upcoming} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <CatchWidget items={data.catchItems} />
        <ActivityFeed activities={data.activities} />
        <StaffWidget staff={data.staff} />
      </div>
    </div>
  )
}
