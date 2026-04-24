import { getSupabase } from '@/lib/supabase'
import { BookingsTable } from '@/components/bookings/BookingsTable'
import { NewBookingDrawer } from '@/components/bookings/NewBookingDrawer'
import { DateNav } from '@/components/bookings/DateNav'

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; floor?: string; status?: string }>
}) {
  const params = await searchParams
  const supabase = getSupabase()
  // Default to IST today (UTC+5:30)
  const istNow = new Date(Date.now() + 5.5 * 60 * 60 * 1000)
  const date = params.date ?? istNow.toISOString().split('T')[0]
  // Query IST midnight boundaries in UTC
  const startUTC = new Date(`${date}T00:00:00+05:30`).toISOString()
  const endUTC = new Date(`${date}T23:59:59+05:30`).toISOString()
  const start = startUTC
  const end = endUTC

  let query = supabase
    .from('bookings')
    .select('*')
    .gte('datetime', start)
    .lte('datetime', end)
    .order('datetime')

  if (params.floor && params.floor !== 'all') {
    query = query.eq('floor', params.floor)
  }
  if (params.status && params.status !== 'all') {
    query = query.eq('status', params.status)
  }

  const { data: bookings } = await query

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">Bookings</h1>
        <div className="flex items-center gap-3">
          <DateNav date={date} />
          <NewBookingDrawer />
        </div>
      </div>
      <BookingsTable bookings={bookings ?? []} />
    </div>
  )
}
