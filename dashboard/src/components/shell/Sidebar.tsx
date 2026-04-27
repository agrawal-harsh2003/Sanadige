'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, CalendarDays, Users, BarChart2, Megaphone, Settings, Map } from 'lucide-react'
import { type Role } from '@/lib/auth'

interface NavItem {
  href: string
  label: string
  roles: Role[]
  icon: React.ElementType
}

const NAV: NavItem[] = [
  { href: '/dashboard',            label: 'Mission Control', roles: ['manager'],          icon: LayoutDashboard },
  { href: '/dashboard/bookings',   label: 'Bookings',        roles: ['manager', 'host'],  icon: CalendarDays },
  { href: '/dashboard/floor',      label: 'Floor Map',       roles: ['manager', 'host'],  icon: Map },
  { href: '/dashboard/guests',     label: 'Guests',          roles: ['manager'],          icon: Users },
  { href: '/dashboard/analytics',  label: 'Analytics',       roles: ['manager'],          icon: BarChart2 },
  { href: '/dashboard/marketing',  label: 'Marketing',       roles: ['manager'],          icon: Megaphone },
  { href: '/dashboard/settings',   label: 'Settings',        roles: ['manager'],          icon: Settings },
]

export function Sidebar({ role, name }: { role: Role; name?: string }) {
  const pathname = usePathname()
  const items = NAV.filter(item => item.roles.includes(role))

  return (
    <aside className="hidden md:flex flex-col w-[220px] min-h-screen bg-sidebar border-r border-sidebar-border">

      {/* Brand */}
      <div className="px-6 pt-8 pb-6">
        <p className="font-cormorant text-sidebar-foreground text-[32px] font-light italic leading-none tracking-wide">
          Sana-di-ge
        </p>
        <div className="flex items-center gap-2 mt-2.5">
          <div className="h-px flex-1 bg-sidebar-foreground/15" />
          <p className="text-[9px] text-sidebar-foreground/50 tracking-[0.22em] uppercase font-medium">New Delhi</p>
          <div className="h-px flex-1 bg-sidebar-foreground/15" />
        </div>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-0.5 px-3 flex-1">
        {items.map(item => {
          const active = pathname === item.href
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-150 ${
                active
                  ? 'bg-white/10 text-sidebar-foreground'
                  : 'text-white/75 hover:text-white hover:bg-white/6'
              }`}
            >
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[22px] rounded-r-full bg-[oklch(0.585_0.135_44)]" />
              )}
              <Icon
                size={15}
                strokeWidth={active ? 2 : 1.5}
                className={`shrink-0 transition-colors ${active ? 'text-[oklch(0.585_0.135_44)]' : 'text-white/60 group-hover:text-white'}`}
              />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Staff pill */}
      {name && (
        <div className="px-4 py-5 border-t border-sidebar-border/50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[oklch(0.585_0.135_44)]/25 flex items-center justify-center shrink-0">
              <span className="font-cormorant text-[oklch(0.585_0.135_44)] text-[15px] font-semibold leading-none">
                {name[0]?.toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sidebar-foreground text-[13px] font-medium truncate leading-tight">{name}</p>
              <p className="text-sidebar-foreground/45 text-[10px] uppercase tracking-[0.12em] mt-0.5">{role}</p>
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}
