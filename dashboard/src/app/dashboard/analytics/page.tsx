import { getAdminDb } from '@/lib/firebase-admin'
import { getSession } from '@/actions/auth'
import { redirect } from 'next/navigation'

function pct(n: number, d: number) {
  if (!d) return '0%'
  return `${Math.round((n / d) * 100)}%`
}

async function getAnalytics() {
  const db = getAdminDb()
  const istNow = new Date(Date.now() + 5.5 * 60 * 60 * 1000)
  const thirtyDaysAgo = new Date(istNow.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const snap = await db.collection('bookings')
    .where('created_at', '>=', thirtyDaysAgo)
    .orderBy('created_at', 'desc')
    .limit(1000)
    .get()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const all = snap.docs.map(d => d.data()) as any[]

  const total = all.length
  const noShows = all.filter(b => b.status === 'no_show').length
  const cancelled = all.filter(b => b.status === 'cancelled').length
  const completed = all.filter(b => b.status === 'completed').length
  const returning = all.filter(b => b.visit_count > 1).length

  // Channel breakdown
  const channels: Record<string, number> = {}
  all.forEach(b => { const ch = b.channel ?? 'whatsapp'; channels[ch] = (channels[ch] ?? 0) + 1 })

  // Daily covers (last 14 days)
  const byDay: Record<string, { covers: number; bookings: number }> = {}
  all.forEach(b => {
    const day = (b.datetime ?? b.created_at ?? '').split('T')[0]
    if (!day) return
    if (!byDay[day]) byDay[day] = { covers: 0, bookings: 0 }
    byDay[day].covers += b.party_size ?? 0
    byDay[day].bookings += 1
  })
  const daily = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(istNow.getTime() - (13 - i) * 24 * 60 * 60 * 1000)
    const dateStr = d.toISOString().split('T')[0]
    return {
      label: d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' }),
      covers: byDay[dateStr]?.covers ?? 0,
      bookings: byDay[dateStr]?.bookings ?? 0,
    }
  })

  // Avg dining duration (completed only)
  const durations = all
    .filter(b => b.checked_in_at && b.completed_at)
    .map(b => (new Date(b.completed_at).getTime() - new Date(b.checked_in_at).getTime()) / 60000)
  const avgDuration = durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : null

  return {
    total, noShows, cancelled, completed,
    noShowRate: pct(noShows, total),
    cancelRate: pct(cancelled, total),
    repeatRate: pct(returning, total),
    channels,
    daily,
    avgDuration,
  }
}

const CHANNEL_LABEL: Record<string, string> = {
  whatsapp: 'WhatsApp', website: 'Website', phone: 'Phone',
  walkin: 'Walk-in', dineout: 'Dineout', eazydiner: 'EazyDiner', google: 'Google',
}

export default async function AnalyticsPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (session.role !== 'manager') redirect('/dashboard/bookings')

  const a = await getAnalytics()
  const maxCovers = Math.max(...a.daily.map(d => d.covers), 1)

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-foreground">Analytics — Last 30 Days</h1>

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Bookings', value: a.total },
          { label: 'Completed', value: a.completed },
          { label: 'No-show Rate', value: a.noShowRate },
          { label: 'Cancellation Rate', value: a.cancelRate },
        ].map(({ label, value }) => (
          <div key={label} className="bg-card shadow-sm ring-1 ring-black/5 rounded-2xl p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground mb-2">{label}</p>
            <p className="text-4xl font-bold text-foreground leading-none">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Daily covers chart */}
        <div className="lg:col-span-2 bg-card shadow-sm ring-1 ring-black/5 rounded-2xl p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground mb-4">Daily Covers (14 days)</p>
          <div className="flex items-end gap-1 h-32">
            {a.daily.map((d, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full bg-primary/20 rounded-t-sm hover:bg-primary/40 transition-colors"
                  style={{ height: `${Math.round((d.covers / maxCovers) * 100)}%`, minHeight: d.covers ? '4px' : '0' }}
                  title={`${d.covers} covers`}
                />
              </div>
            ))}
          </div>
          <div className="flex gap-1 mt-1">
            {a.daily.map((d, i) => (
              <div key={i} className="flex-1 text-center text-[8px] text-muted-foreground/60 truncate">{d.label}</div>
            ))}
          </div>
        </div>

        {/* Right column: channel + stats */}
        <div className="flex flex-col gap-4">
          {/* Channel breakdown */}
          <div className="bg-card shadow-sm ring-1 ring-black/5 rounded-2xl p-5 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground mb-3">By Channel</p>
            <div className="space-y-2">
              {Object.entries(a.channels).sort((x, y) => y[1] - x[1]).map(([ch, count]) => (
                <div key={ch} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-20 shrink-0">{CHANNEL_LABEL[ch] ?? ch}</span>
                  <div className="flex-1 bg-muted rounded-full h-1.5">
                    <div className="bg-primary h-1.5 rounded-full" style={{ width: pct(count, a.total) }} />
                  </div>
                  <span className="text-xs font-semibold text-foreground w-6 text-right">{count}</span>
                </div>
              ))}
              {!Object.keys(a.channels).length && <p className="text-sm text-muted-foreground">No data yet</p>}
            </div>
          </div>

          {/* Repeat + duration */}
          <div className="bg-card shadow-sm ring-1 ring-black/5 rounded-2xl p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground mb-3">Guest Insights</p>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground">Repeat Guest Rate</p>
                <p className="text-2xl font-bold text-foreground">{a.repeatRate}</p>
              </div>
              {a.avgDuration && (
                <div>
                  <p className="text-xs text-muted-foreground">Avg Dining Duration</p>
                  <p className="text-2xl font-bold text-foreground">{a.avgDuration} min</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
