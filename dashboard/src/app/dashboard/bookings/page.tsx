import { getAdminDb } from '@/lib/firebase-admin'
import { BookingsTable } from '@/components/bookings/BookingsTable'
import { NewBookingDrawer } from '@/components/bookings/NewBookingDrawer'
import { DateNav } from '@/components/bookings/DateNav'

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; floor?: string; status?: string }>
}) {
  const params = await searchParams
  const db = getAdminDb()
  const istNow = new Date(Date.now() + 5.5 * 60 * 60 * 1000)
  const date = params.date ?? istNow.toISOString().split('T')[0]
  const startISO = `${date}T00:00:00+05:30`
  const endISO   = `${date}T23:59:59+05:30`
  let query: FirebaseFirestore.Query = db.collection('bookings')
    .where('datetime', '>=', startISO).where('datetime', '<=', endISO).orderBy('datetime')
  if (params.floor && params.floor !== 'all') query = query.where('floor', '==', params.floor)
  if (params.status && params.status !== 'all') query = query.where('status', '==', params.status)
  const snap = await query.get()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bookings = snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[]
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">Bookings</h1>
        <div className="flex items-center gap-3"><DateNav date={date} /><NewBookingDrawer /></div>
      </div>
      <BookingsTable bookings={bookings} date={date} />
    </div>
  )
}
