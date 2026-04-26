import { getAdminDb } from '@/lib/firebase-admin'
import { KpiRow } from '@/components/home/KpiRow'
import { BookingsChart } from '@/components/home/BookingsChart'
import { UpcomingBookings } from '@/components/home/UpcomingBookings'

async function getDashboardData() {
  const db = getAdminDb()
  const istNow = new Date(Date.now() + 5.5 * 60 * 60 * 1000)
  const today = istNow.toISOString().split('T')[0]
  const todayStart = `${today}T00:00:00+05:30`
  const todayEnd   = `${today}T23:59:59+05:30`
  const thirtyDaysAgo = new Date(istNow.getTime() - 30 * 24 * 60 * 60 * 1000)

  const [todaySnap, monthSnap, configSnap] = await Promise.all([
    db.collection('bookings')
      .where('datetime', '>=', todayStart)
      .where('datetime', '<=', todayEnd)
      .orderBy('datetime')
      .get(),
    db.collection('bookings')
      .where('datetime', '>=', thirtyDaysAgo.toISOString())
      .where('status', 'in', ['confirmed', 'seated', 'checked_in', 'completed'])
      .orderBy('datetime')
      .get(),
    db.collection('service_config').doc(today).get(),
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const todayBookings = todaySnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const monthBookings = monthSnap.docs.map(d => d.data()) as any[]

  const coverCap = (configSnap.exists ? (configSnap.data() as any).cover_cap : null) ?? 60
  const active = todayBookings.filter(b => ['confirmed', 'checked_in', 'seated'].includes(b.status))
  const bookedSeats = active.reduce((s: number, b: any) => s + (b.party_size ?? 0), 0)
  const noShows = todayBookings.filter(b => b.status === 'no_show').length
  const checkedIn = todayBookings.filter(b => ['checked_in', 'seated'].includes(b.status)).length
  const availableSeats = Math.max(0, coverCap - bookedSeats)

  const byDay: Record<string, number> = {}
  monthBookings.forEach((b: any) => {
    const day = b.datetime?.split('T')[0]
    if (day) byDay[day] = (byDay[day] ?? 0) + 1
  })

  const weekData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(istNow.getTime() - (6 - i) * 24 * 60 * 60 * 1000)
    const dateStr = d.toISOString().split('T')[0]
    return { day: d.toLocaleDateString('en-IN', { weekday: 'short' }), count: byDay[dateStr] ?? 0, isToday: dateStr === today }
  })

  const monthData = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(istNow.getTime() - (29 - i) * 24 * 60 * 60 * 1000)
    const dateStr = d.toISOString().split('T')[0]
    return { day: d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }), count: byDay[dateStr] ?? 0, isToday: dateStr === today }
  })

  return {
    kpi: { todayBookings: active.length, availableSeats, checkedIn, noShows },
    upcoming: todayBookings.filter(b => ['confirmed', 'checked_in'].includes(b.status)).slice(0, 5),
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
    </div>
  )
}
