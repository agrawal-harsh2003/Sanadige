import { logout } from '@/actions/auth'
import { type Session } from '@/lib/auth'
import { Button } from '@/components/ui/button'

const ROLE_BADGE: Record<string, string> = {
  manager: 'bg-accent/10 text-accent ring-1 ring-accent/20',
  host:    'bg-primary/10 text-primary ring-1 ring-primary/20',
}

export function Topbar({ session }: { session: Session }) {
  return (
    <header className="h-14 border-b border-border bg-card shadow-sm flex items-center justify-between px-6">
      <div />
      <div className="flex items-center gap-3">
        <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full uppercase tracking-wide ${ROLE_BADGE[session.role] ?? ''}`}>
          {session.role}
        </span>
        <span className="text-sm font-medium text-foreground">{session.name}</span>
        <form action={logout}>
          <Button variant="ghost" size="sm" type="submit" className="text-muted-foreground hover:text-primary">
            Sign out
          </Button>
        </form>
      </div>
    </header>
  )
}
