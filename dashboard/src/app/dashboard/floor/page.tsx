import { getAdminDb } from '@/lib/firebase-admin'
import { getSession } from '@/actions/auth'
import { redirect } from 'next/navigation'
import { FloorMap } from '@/components/floor/FloorMap'
import { SeedTablesButton } from '@/components/floor/SeedTablesButton'

export interface TableWithStatus {
  id: string
  floor: string
  table_number: string
  capacity: number
  // status
  status: 'available' | 'upcoming' | 'occupied' | 'cleaning'
  booking?: {
    id: string
    guest_name: string
    party_size: number
    datetime: string
    booking_ref: string
    status: string
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function computeTableStatus(table: any, bookings: any[], now: Date): TableWithStatus {
  const tableBookings = bookings.filter(b => b.table_id === table.id)

  // Check for occupied (checked_in or seated right now)
  const occupied = tableBookings.find(b => ['checked_in', 'seated'].includes(b.status))
  if (occupied) return { ...table, status: 'occupied', booking: occupied }

  // Check cleaning buffer (completed in last 15 min)
  const recentlyCompleted = tableBookings.find(b => {
    if (b.status !== 'completed' || !b.completed_at) return false
    const completedAt = new Date(b.completed_at)
    return now.getTime() - completedAt.getTime() < 15 * 60 * 1000
  })
  if (recentlyCompleted) return { ...table, status: 'cleaning', booking: recentlyCompleted }

  // Check upcoming (confirmed booking in next 60 min — assigned or on this floor)
  const upcoming = bookings.find(b => {
    if (b.status !== 'confirmed') return false
    if (b.table_id && b.table_id !== table.id) return false
    if (!b.table_id && b.floor !== table.floor) return false
    const dt = new Date(b.datetime)
    const diff = dt.getTime() - now.getTime()
    return diff > 0 && diff <= 60 * 60 * 1000
  })
  if (upcoming) return { ...table, status: 'upcoming', booking: upcoming }

  return { ...table, status: 'available' }
}

async function getFloorData() {
  const db = getAdminDb()
  const istNow = new Date(Date.now() + 5.5 * 60 * 60 * 1000)
  const today = istNow.toISOString().split('T')[0]

  const [tablesSnap, bookingsSnap, checkedInSnap] = await Promise.all([
    db.collection('tables').where('is_active', '==', true).get(),
    db.collection('bookings')
      .where('datetime', '>=', `${today}T00:00:00+05:30`)
      .where('datetime', '<=', `${today}T23:59:59+05:30`)
      .where('status', 'in', ['confirmed', 'checked_in', 'seated', 'completed'])
      .get(),
    // Checked-in bookings without a table — need table assignment
    db.collection('bookings')
      .where('datetime', '>=', `${today}T00:00:00+05:30`)
      .where('datetime', '<=', `${today}T23:59:59+05:30`)
      .where('status', '==', 'checked_in')
      .get(),
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tables = tablesSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bookings = bookingsSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const needsTable = checkedInSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[]

  const tablesWithStatus: TableWithStatus[] = tables.map(t =>
    computeTableStatus(t, bookings, istNow)
  )

  return { tablesWithStatus, needsTable, hasNoTables: tables.length === 0 }
}

export default async function FloorPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  let floorData: Awaited<ReturnType<typeof getFloorData>>
  try {
    floorData = await getFloorData()
  } catch (err) {
    console.error('[floor] getFloorData error:', err)
    floorData = { tablesWithStatus: [], needsTable: [], hasNoTables: true }
  }
  const { tablesWithStatus, needsTable, hasNoTables } = floorData

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-cormorant text-[2rem] font-semibold text-foreground leading-none">Floor Map</h1>
        <div className="flex items-center gap-4">
          {/* Legend */}
          <div className="hidden sm:flex items-center gap-3 text-xs text-muted-foreground">
            {[
              { color: 'bg-emerald-500', label: 'Available' },
              { color: 'bg-amber-400',   label: 'Upcoming' },
              { color: 'bg-primary',     label: 'Occupied' },
              { color: 'bg-muted-foreground/40', label: 'Cleaning' },
            ].map(l => (
              <span key={l.label} className="flex items-center gap-1.5">
                <span className={`w-2.5 h-2.5 rounded-full ${l.color}`} />
                {l.label}
              </span>
            ))}
          </div>
          {session.role === 'manager' && hasNoTables && <SeedTablesButton />}
        </div>
      </div>

      {hasNoTables ? (
        <div className="bg-card shadow-sm ring-1 ring-black/[0.04] rounded-2xl p-12 text-center">
          <p className="text-muted-foreground mb-4">No tables configured yet.</p>
          {session.role === 'manager' && (
            <p className="text-sm text-muted-foreground">Use the &ldquo;Seed Tables&rdquo; button to create the default table layout.</p>
          )}
        </div>
      ) : (
        <FloorMap tables={tablesWithStatus} needsTable={needsTable} />
      )}
    </div>
  )
}
