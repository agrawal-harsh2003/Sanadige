import { logout } from '@/actions/auth'
import { type Session } from '@/lib/auth'
import { Button } from '@/components/ui/button'

const ROLE_BADGE: Record<string, string> = {
  manager: 'bg-accent/10 text-accent ring-1 ring-accent/20',
  host:    'bg-primary/10 text-primary ring-1 ring-primary/20',
}

export function Topbar({ session }: { session: Session }) {
  return (
    <header className="h-14 border-b border-border bg-card/80 backdrop-blur-sm flex items-center justify-between px-6 sticky top-0 z-20">
      <div />
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2.5">
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-[0.1em] ${ROLE_BADGE[session.role] ?? ''}`}>
            {session.role}
          </span>
          <span className="text-sm text-foreground font-medium">{session.name}</span>
        </div>
        <div className="h-4 w-px bg-border" />
        <form action={logout}>
          <Button variant="ghost" size="sm" type="submit" className="text-[13px] text-muted-foreground hover:text-foreground h-8 px-3">
            Sign out
          </Button>
        </form>
      </div>
    </header>
  )
}
