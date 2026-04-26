import { getAdminDb } from '@/lib/firebase-admin'
import { getSession } from '@/actions/auth'
import { redirect } from 'next/navigation'
import { CampaignBuilder } from '@/components/marketing/CampaignBuilder'

async function getCampaigns() {
  const db = getAdminDb()
  const snap = await db.collection('campaigns').orderBy('created_at', 'desc').limit(20).get()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[]
}

const STATUS_BADGE: Record<string, string> = {
  draft:     'bg-muted text-muted-foreground',
  sent:      'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  scheduled: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
}
const SEGMENT_LABEL: Record<string, string> = {
  lapsed:    'Lapsed (90+ days)',
  birthday:  'Upcoming Birthdays',
  milestone: 'Milestone Guests',
  custom:    'Custom Segment',
}

export default async function MarketingPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (session.role !== 'manager') redirect('/dashboard/bookings')

  const campaigns = await getCampaigns()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">Marketing</h1>
        <CampaignBuilder />
      </div>

      {/* Automated triggers strip */}
      <div className="bg-card shadow-sm ring-1 ring-black/5 rounded-2xl p-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground mb-4">Automated Triggers (always on)</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { icon: '😴', label: 'Lapsed Guest', desc: 'WhatsApp re-engagement to guests not seen in 90+ days', timing: 'Daily' },
            { icon: '🎂', label: 'Birthday Invite', desc: 'Celebration invite sent 7 days before birthday', timing: 'Daily' },
            { icon: '⭐', label: 'Milestone', desc: 'Personalised message on 5th, 10th, 20th visit', timing: 'On visit' },
            { icon: '💔', label: 'Post-Cancellation', desc: 'Recovery message 2 days after a cancellation', timing: 'Automatic' },
          ].map(t => (
            <div key={t.label} className="bg-muted/30 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-lg">{t.icon}</span>
                <span className="text-[9px] font-semibold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">{t.timing}</span>
              </div>
              <p className="text-sm font-semibold text-foreground">{t.label}</p>
              <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{t.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Campaign history */}
      <div className="bg-card shadow-sm ring-1 ring-black/5 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">Campaign History</p>
        </div>
        {campaigns.length === 0 ? (
          <div className="px-5 py-12 text-center text-muted-foreground text-sm">No campaigns yet. Create one to get started.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                {['Campaign', 'Segment', 'Sent', 'Status', 'Date'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c, i) => (
                <tr key={c.id} className={`border-b border-border hover:bg-muted/20 ${i % 2 === 1 ? 'bg-muted/10' : ''}`}>
                  <td className="px-4 py-3 font-medium text-foreground">{c.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{SEGMENT_LABEL[c.segment_type] ?? c.segment_type}</td>
                  <td className="px-4 py-3 text-foreground">{c.sent_count ?? 0}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_BADGE[c.status] ?? 'bg-muted text-muted-foreground'}`}>
                      {c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {c.sent_at ? new Date(c.sent_at).toLocaleDateString('en-IN') : c.created_at?.split('T')[0] ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
