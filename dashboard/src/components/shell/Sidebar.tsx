'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { type Role } from '@/lib/auth'

interface NavItem {
  href: string
  label: string
  roles: Role[]
  icon: string
}

const NAV: NavItem[] = [
  { href: '/dashboard', label: 'Mission Control', roles: ['manager'], icon: '⌂' },
  { href: '/dashboard/catch', label: "Today's Catch", roles: ['manager', 'chef'], icon: '🐟' },
  { href: '/dashboard/bookings', label: 'Bookings', roles: ['manager', 'host'], icon: '📋' },
  { href: '/dashboard/floor', label: 'Floor Map', roles: ['manager', 'host'], icon: '🗺' },
  { href: '/dashboard/staff', label: 'Staff', roles: ['manager'], icon: '👥' },
  { href: '/dashboard/analytics', label: 'Analytics', roles: ['manager'], icon: '📊' },
]

export function Sidebar({ role }: { role: Role }) {
  const pathname = usePathname()
  const items = NAV.filter(item => item.roles.includes(role))

  return (
    <aside className="hidden md:flex flex-col w-[220px] min-h-screen bg-surface border-r border-border px-3 py-6">
      <div className="flex items-center gap-2 px-3 mb-8">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
          <span className="text-white text-sm font-bold">S</span>
        </div>
        <span className="font-bold text-[#1a2e1a]">Sanadige</span>
      </div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted px-3 mb-2">Navigation</p>
      <nav className="flex flex-col gap-1">
        {items.map(item => {
          const active = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                active ? 'bg-primary text-white' : 'text-[#1a2e1a] hover:bg-background'
              }`}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
