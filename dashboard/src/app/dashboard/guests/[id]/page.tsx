import { getAdminDb } from '@/lib/firebase-admin'
import { getSession } from '@/actions/auth'
import { redirect, notFound } from 'next/navigation'
import { GuestNoteDrawer } from '@/components/guests/GuestNoteDrawer'
import { GuestTierSelect } from '@/components/guests/GuestTierSelect'

const TIER_BADGE: Record<string, string> = {
  vip:       'bg-amber-50 text-amber-800 ring-1 ring-amber-200',
  preferred: 'bg-primary/10 text-primary ring-1 ring-primary/20',
  standard:  'bg-muted text-muted-foreground',
}

const STATUS_BADGE: Record<string, string> = {
  confirmed:  'bg-primary/10 text-primary',
  seated:     'bg-emerald-50 text-emerald-800',
  completed:  'bg-emerald-50 text-emerald-700',
  checked_in: 'bg-blue-50 text-blue-700',
  cancelled:  'bg-rose-50 text-rose-700',
  no_show:    'bg-muted text-muted-foreground',
}

function formatIST(datetime: string) {
  return new Date(datetime).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short',
    year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export default async function GuestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (session.role !== 'manager') redirect('/dashboard/bookings')

  const { id } = await params
  const db = getAdminDb()

  const [guestDoc, notesSnap, bookingsSnap] = await Promise.all([
    db.collection('guests').doc(id).get(),
    db.collection('guests').doc(id).collection('notes').orderBy('created_at', 'desc').get(),
    db.collection('bookings').where('guest_id', '==', id).orderBy('datetime', 'desc').limit(20).get(),
  ])

  if (!guestDoc.exists) notFound()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const guest = { id: guestDoc.id, ...guestDoc.data() } as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const notes = notesSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bookings = bookingsSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[]

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-cormorant text-[2rem] font-semibold text-foreground leading-none">{guest.name}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{guest.phone}{guest.email ? ` \u00b7 ${guest.email}` : ''}</p>
        </div>
        <GuestTierSelect guestId={id} currentTier={guest.tier} />
      </div>
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Visits', value: guest.visit_count },
          { label: 'Tier', value: <span className={`text-sm font-semibold px-2 py-0.5 rounded-full capitalize ${TIER_BADGE[guest.tier]}`}>{guest.tier}</span> },
          { label: 'First Visit', value: guest.first_visit_at ? new Date(guest.first_visit_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '\u2014' },
        ].map(({ label, value }) => (
          <div key={label} className="bg-card shadow-sm ring-1 ring-black/[0.04] rounded-2xl p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground mb-2">{label}</p>
            <p className="text-2xl font-bold text-foreground">{value}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card shadow-sm ring-1 ring-black/[0.04] rounded-2xl p-5 space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">Profile</p>
          {([['Dietary', guest.dietary_notes], ['Seating', guest.seating_preference], ['Marketing', guest.is_marketing_opted_in ? 'Opted in' : 'Opted out']] as [string,string][]).map(([label, value]) => (
            <div key={label} className="flex justify-between text-sm">
              <span className="text-muted-foreground">{label}</span>
              <span className="text-foreground font-medium">{value ?? '\u2014'}</span>
            </div>
          ))}
        </div>
        <div className="bg-card shadow-sm ring-1 ring-black/[0.04] rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">Staff Notes</p>
            <GuestNoteDrawer guestId={id} staffName={session.name} />
          </div>
          {notes.length === 0 && <p className="text-sm text-muted-foreground">No notes yet.</p>}
          {notes.map((n: any) => (
            <div key={n.id} className="border-l-2 border-border pl-3">
              <p className="text-sm text-foreground">{n.note}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{n.added_by} \u00b7 {new Date(n.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="bg-card shadow-sm ring-1 ring-black/[0.04] rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-border">
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">Booking History</p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              {['Ref', 'Date & Time', 'Floor', 'Party', 'Occasion', 'Status'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {bookings.map((b: any, i: number) => (
              <tr key={b.id} className={`border-b border-border ${i % 2 === 0 ? '' : 'bg-muted/10'}`}>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{b.booking_ref}</td>
                <td className="px-4 py-3 text-foreground">{formatIST(b.datetime)}</td>
                <td className="px-4 py-3 text-muted-foreground capitalize">{b.floor}</td>
                <td className="px-4 py-3 text-foreground">{b.party_size}</td>
                <td className="px-4 py-3 text-muted-foreground">{b.occasion ?? '\u2014'}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${STATUS_BADGE[b.status] ?? 'bg-muted'}`}>{b.status?.replace('_', ' ')}</span>
                </td>
              </tr>
            ))}
            {bookings.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">No bookings recorded</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
