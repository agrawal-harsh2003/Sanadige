import { redirect } from 'next/navigation'
import { getSession } from '@/actions/auth'
import { MissionControl } from './_components/MissionControl'

export default async function DashboardPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (session.role !== 'manager') redirect('/dashboard/bookings')
  return <MissionControl />
}
