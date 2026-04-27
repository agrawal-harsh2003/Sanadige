'use client'
import { type Session } from '@/lib/auth'
import { useRouter } from 'next/navigation'

const ROLE_LABEL: Record<string, string> = {
  manager: 'Manager',
  host: 'Host',
}

const ROLE_STYLE: Record<string, string> = {
  manager: 'bg-[oklch(0.585_0.135_44)]/12 text-[oklch(0.48_0.12_44)] ring-1 ring-[oklch(0.585_0.135_44)]/20',
  host:    'bg-[oklch(0.235_0.052_196)]/10 text-[oklch(0.235_0.052_196)] ring-1 ring-[oklch(0.235_0.052_196)]/20',
}

export function Topbar({ session }: { session: Session }) {
  const router = useRouter()

  async function handleSignOut() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  return (
    <header className="h-13 border-b border-border bg-card/90 backdrop-blur-sm flex items-center justify-end px-6 sticky top-0 z-20 gap-3">
      <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full uppercase tracking-[0.12em] ${ROLE_STYLE[session.role] ?? ''}`}>
        {ROLE_LABEL[session.role] ?? session.role}
      </span>
      <span className="text-[13px] text-foreground font-medium">{session.name}</span>
      <div className="h-3.5 w-px bg-border mx-0.5" />
      <button
        onClick={handleSignOut}
        className="text-[12px] text-muted-foreground hover:text-foreground transition-colors px-2.5 py-1"
      >
        Sign out
      </button>
    </header>
  )
}
