'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, CalendarDays, Users } from 'lucide-react'
import { type Role } from '@/lib/auth'

interface NavItem {
  href: string
  label: string
  roles: Role[]
  icon: React.ElementType
}

const NAV: NavItem[] = [
  { href: '/dashboard',          label: 'Mission Control', roles: ['manager'],                           icon: LayoutDashboard },
  { href: '/dashboard/bookings', label: 'Bookings',        roles: ['manager', 'host', 'waiter', 'chef'], icon: CalendarDays },
  { href: '/dashboard/guests',   label: 'Guests',          roles: ['manager'],                           icon: Users },
]

const ROLE_STYLE: Record<string, string> = {
  manager: 'bg-accent/20 text-accent-foreground',
  host: 'bg-sidebar-accent text-sidebar-accent-foreground',
  chef: 'bg-amber-500/20 text-amber-200',
  waiter: 'bg-emerald-500/20 text-emerald-300',
}

export function Sidebar({ role, name }: { role: Role; name?: string }) {
  const pathname = usePathname()
  const items = NAV.filter(item => item.roles.includes(role))

  return (
    <aside className="hidden md:flex flex-col w-[230px] min-h-screen bg-sidebar border-r border-sidebar-border">
      {/* Brand */}
      <div className="px-5 py-6 border-b border-sidebar-border">
        <p className="text-sidebar-foreground font-bold text-xl tracking-tight">Sanadige</p>
        <p className="text-[11px] text-sidebar-foreground/50 mt-0.5">Where the coast meets Delhi</p>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-0.5 px-3 py-4 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-sidebar-foreground/40 px-2 mb-2">Navigation</p>
        {items.map(item => {
          const active = pathname === item.href
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                active
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground border-l-2 border-accent pl-[10px]'
                  : 'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50'
              }`}
            >
              <Icon size={16} strokeWidth={active ? 2.5 : 1.8} />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Staff pill */}
      {name && (
        <div className="px-4 py-4 border-t border-sidebar-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center flex-shrink-0">
              <span className="text-accent-foreground text-sm font-bold">{name[0]?.toUpperCase()}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sidebar-foreground text-sm font-medium truncate">{name}</p>
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full uppercase tracking-wide ${ROLE_STYLE[role] ?? ''}`}>
                {role}
              </span>
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}
