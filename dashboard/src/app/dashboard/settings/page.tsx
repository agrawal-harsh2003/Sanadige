import { getAdminDb } from '@/lib/firebase-admin'
import { getSession } from '@/actions/auth'
import { redirect } from 'next/navigation'
import { ServiceConfigForm } from './_components/ServiceConfigForm'

async function getServiceConfig(date: string) {
  const db = getAdminDb()
  const snap = await db.collection('service_config').doc(date).get()
  return snap.exists ? snap.data() : null
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>
}) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (session.role !== 'manager') redirect('/dashboard/bookings')

  const params = await searchParams
  const istNow = new Date(Date.now() + 5.5 * 60 * 60 * 1000)
  const date = params.date ?? istNow.toISOString().split('T')[0]
  const config = await getServiceConfig(date)

  return (
    <div className="space-y-6">
      <h1 className="font-cormorant text-[2rem] font-semibold text-foreground leading-none">Settings</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Service config */}
        <div className="bg-card shadow-sm ring-1 ring-black/[0.04] rounded-2xl p-6">
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground mb-4">Service Configuration</p>
          <ServiceConfigForm date={date} config={config as { cover_cap?: number; walkin_allocation_pct?: number; is_closed?: boolean; notes?: string } | null} />
        </div>

        {/* Business rules summary */}
        <div className="bg-card shadow-sm ring-1 ring-black/[0.04] rounded-2xl p-6">
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground mb-4">Business Rules</p>
          <div className="space-y-4 text-sm">
            <div className="space-y-1">
              <p className="font-semibold text-foreground">Deposit Policy</p>
              <p className="text-muted-foreground">Dinner: ₹500 / cover &nbsp;·&nbsp; Lunch: ₹250 / cover</p>
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-foreground">Cancellation Refund</p>
              <p className="text-muted-foreground">24h+: full refund</p>
              <p className="text-muted-foreground">4–24h: 50% refund</p>
              <p className="text-muted-foreground">Under 4h: no refund</p>
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-foreground">No-show</p>
              <p className="text-muted-foreground">Auto-marked 20 min after reservation time. Deposit captured.</p>
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-foreground">Turn Times</p>
              <p className="text-muted-foreground">1–2 pax: 90 min &nbsp;·&nbsp; 3–4 pax: 105 min</p>
              <p className="text-muted-foreground">5–6 pax: 120 min &nbsp;·&nbsp; 7+ pax: 150 min</p>
              <p className="text-muted-foreground">Private: 180 min</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
