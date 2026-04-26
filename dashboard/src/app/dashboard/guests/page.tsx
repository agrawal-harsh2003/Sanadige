import { getAdminDb } from '@/lib/firebase-admin'
import { getSession } from '@/actions/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'

const TIER_BADGE: Record<string, string> = {
  vip:       'bg-amber-50 text-amber-800 ring-1 ring-amber-200',
  preferred: 'bg-primary/10 text-primary ring-1 ring-primary/20',
  standard:  'bg-muted text-muted-foreground',
}

export default async function GuestsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tier?: string }>
}) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (session.role !== 'manager') redirect('/dashboard/bookings')

  const params = await searchParams
  const db = getAdminDb()

  let query: FirebaseFirestore.Query = db.collection('guests').orderBy('visit_count', 'desc').limit(100)
  if (params.tier && params.tier !== 'all') query = query.where('tier', '==', params.tier)

  const snap = await query.get()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let guests = snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[]
  if (params.q) {
    const q = params.q.toLowerCase()
    guests = guests.filter((g: any) => g.name?.toLowerCase().includes(q))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">Guests</h1>
        <p className="text-sm text-muted-foreground">{guests.length} profiles</p>
      </div>
      <div className="flex gap-3">
        <form className="flex gap-3 flex-1">
          <input name="q" defaultValue={params.q} placeholder="Search by name…"
            className="flex-1 h-9 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
          <select name="tier" defaultValue={params.tier ?? 'all'}
            className="h-9 rounded-lg border border-border bg-background px-3 text-sm">
            <option value="all">All tiers</option>
            <option value="vip">VIP</option>
            <option value="preferred">Preferred</option>
            <option value="standard">Standard</option>
          </select>
          <button type="submit" className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium">Search</button>
        </form>
      </div>
      <div className="bg-card shadow-sm ring-1 ring-black/5 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              {['Name', 'Phone', 'Tier', 'Visits', 'Last Visit', 'Dietary', 'Marketing'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {guests.map((g: any, i: number) => (
              <tr key={g.id} className={`border-b border-border hover:bg-muted/30 transition-colors ${i % 2 === 0 ? '' : 'bg-muted/10'}`}>
                <td className="px-4 py-3">
                  <Link href={`/dashboard/guests/${g.id}`} className="font-medium text-foreground hover:text-primary transition-colors">{g.name}</Link>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{g.phone}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${TIER_BADGE[g.tier] ?? ''}`}>{g.tier}</span>
                </td>
                <td className="px-4 py-3 font-semibold text-foreground">{g.visit_count}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {g.last_visit_at ? new Date(g.last_visit_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' }) : '—'}
                </td>
                <td className="px-4 py-3 text-muted-foreground max-w-[150px] truncate">{g.dietary_notes ?? '—'}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs ${g.is_marketing_opted_in ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                    {g.is_marketing_opted_in ? 'Opted in' : 'Opted out'}
                  </span>
                </td>
              </tr>
            ))}
            {guests.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-16 text-center text-muted-foreground">No guests found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
