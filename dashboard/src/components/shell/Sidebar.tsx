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
    <aside className="hidden md:flex flex-col w-[240px] min-h-screen bg-sidebar border-r border-sidebar-border">
      {/* Brand */}
      <div className="px-6 pt-7 pb-6 border-b border-sidebar-border/60">
        <p className="font-cormorant text-sidebar-foreground text-[28px] font-semibold leading-none tracking-wide">
          Sanadige
        </p>
        <p className="text-[11px] text-sidebar-foreground/40 mt-1.5 tracking-[0.08em] uppercase font-medium">
          New Delhi
        </p>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-0.5 px-3 py-5 flex-1">
        {items.map(item => {
          const active = pathname === item.href
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all duration-150 ${
                active
                  ? 'bg-white/8 text-sidebar-foreground'
                  : 'text-sidebar-foreground/55 hover:text-sidebar-foreground/85 hover:bg-white/5'
              }`}
            >
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full bg-[oklch(0.585_0.135_44)]" />
              )}
              <Icon
                size={15}
                strokeWidth={active ? 2 : 1.6}
                className={active ? 'text-[oklch(0.585_0.135_44)]' : ''}
              />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Staff pill */}
      {name && (
        <div className="px-4 py-4 border-t border-sidebar-border/60">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[oklch(0.585_0.135_44)]/20 ring-1 ring-[oklch(0.585_0.135_44)]/30 flex items-center justify-center flex-shrink-0">
              <span className="text-[oklch(0.585_0.135_44)] text-[13px] font-cormorant font-semibold leading-none">
                {name[0]?.toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sidebar-foreground text-[13px] font-medium truncate leading-snug">{name}</p>
              <p className="text-sidebar-foreground/40 text-[10px] uppercase tracking-[0.1em] leading-none mt-0.5">{role}</p>
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}
