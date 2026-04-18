import { redirect } from 'next/navigation'
import { getSession } from '@/actions/auth'
import { Sidebar } from '@/components/shell/Sidebar'
import { Topbar } from '@/components/shell/Topbar'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) redirect('/login')

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar role={session.role} />
      <div className="flex-1 flex flex-col">
        <Topbar session={session} />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  )
}
