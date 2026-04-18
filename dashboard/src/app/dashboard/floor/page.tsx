import { getSupabase } from '@/lib/supabase'
import { FloorMap } from '@/components/floor/FloorMap'

type TableStatus = 'available' | 'booked' | 'seated'

export default async function FloorPage() {
  const supabase = getSupabase()
  const now = new Date()
  const twoHoursLater = new Date(now.getTime() + 2 * 60 * 60 * 1000)

  const { data: bookings } = await supabase
    .from('bookings')
    .select('id, floor, status, datetime')
    .in('status', ['confirmed', 'seated'])
    .gte('datetime', now.toISOString())
    .lte('datetime', twoHoursLater.toISOString())

  // Map floor name → status (simplified — tables within same floor share state)
  const floorStatus: Record<string, TableStatus> = {}
  for (const b of bookings ?? []) {
    floorStatus[b.floor] = b.status === 'seated' ? 'seated' : 'booked'
  }

  // Map individual table IDs to states based on their floor
  const tableStates: Record<string, TableStatus> = {}
  const floorTableMap: Record<string, string[]> = {
    terrace: ['t1','t2','t3','t4','t5','t6'],
    floor1: ['f1t1','f1t2','f1t3','f1t4','f1t5','f1t6','f1t7','f1t8'],
    floor2: ['f2t1','f2t2','f2t3','f2t4','f2t5','f2t6','f2t7'],
    private: ['p1'],
  }
  for (const [floor, tableIds] of Object.entries(floorTableMap)) {
    const status = floorStatus[floor] ?? 'available'
    for (const tid of tableIds) {
      tableStates[tid] = status
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-[#1a2e1a]">Floor Map</h1>
      <FloorMap tableStates={tableStates} />
      <p className="text-xs text-text-muted">Showing bookings in the next 2 hours. Colours: green = available, amber = booked, red = seated.</p>
    </div>
  )
}
