import { getSupabase } from '@/lib/supabase'
import { BookingsTable } from '@/components/bookings/BookingsTable'
import { NewBookingDrawer } from '@/components/bookings/NewBookingDrawer'

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; floor?: string; status?: string }>
}) {
  const params = await searchParams
  const supabase = getSupabase()
  const date = params.date ?? new Date().toISOString().split('T')[0]
  const start = `${date}T00:00:00`
  const end = `${date}T23:59:59`

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
        <NewBookingDrawer />
      </div>
      <BookingsTable bookings={bookings ?? []} />
    </div>
  )
}
