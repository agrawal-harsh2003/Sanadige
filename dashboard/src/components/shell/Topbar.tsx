import { logout } from '@/actions/auth'
import { type JwtPayload } from '@/lib/auth'
import { Button } from '@/components/ui/button'

const ROLE_BADGE: Record<string, string> = {
  manager: 'bg-green-100 text-green-800',
  chef: 'bg-orange-100 text-orange-800',
  host: 'bg-blue-100 text-blue-800',
}

export function Topbar({ session }: { session: JwtPayload }) {
  return (
    <header className="h-14 border-b border-border bg-surface flex items-center justify-between px-6">
      <div />
      <div className="flex items-center gap-3">
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide ${ROLE_BADGE[session.role] ?? ''}`}>
          {session.role}
        </span>
        <span className="text-sm font-medium text-[#1a2e1a]">{session.name}</span>
        <form action={logout}>
          <Button variant="ghost" size="sm" type="submit" className="text-text-muted">
            Sign out
          </Button>
        </form>
      </div>
    </header>
  )
}
