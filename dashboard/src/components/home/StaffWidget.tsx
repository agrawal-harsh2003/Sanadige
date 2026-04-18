import Link from 'next/link'

const ROLE_COLORS: Record<string, string> = {
  manager: 'bg-green-500',
  chef: 'bg-orange-500',
  host: 'bg-blue-500',
}

interface StaffMember { id: string; name: string; role: string }

export function StaffWidget({ staff }: { staff: StaffMember[] }) {
  return (
    <div className="bg-surface border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-semibold text-[#1a2e1a]">Staff on Duty</p>
        <Link href="/dashboard/staff" className="text-xs text-[#c8956c] hover:underline">Manage →</Link>
      </div>
      <div className="flex flex-wrap gap-3">
        {staff.map(s => (
          <div key={s.id} className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full ${ROLE_COLORS[s.role] ?? 'bg-gray-400'} flex items-center justify-center`}>
              <span className="text-white text-xs font-bold">{s.name[0]?.toUpperCase()}</span>
            </div>
            <span className="text-sm text-[#1a2e1a]">{s.name}</span>
          </div>
        ))}
        {staff.length === 0 && <p className="text-sm text-text-muted">No staff found</p>}
      </div>
    </div>
  )
}
