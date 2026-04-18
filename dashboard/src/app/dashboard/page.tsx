import { redirect } from 'next/navigation'
import { getSession } from '@/actions/auth'

export default async function DashboardPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (session.role === 'chef') redirect('/dashboard/catch')
  if (session.role === 'host') redirect('/dashboard/bookings')
  // Manager: render Mission Control inline (placeholder until Task 10)
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-[#1a2e1a]">Mission Control</h1>
      <p className="text-text-muted">Loading dashboard data…</p>
    </div>
  )
}
