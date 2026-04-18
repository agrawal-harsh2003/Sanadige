import Link from 'next/link'

const STATUS_DOT: Record<string, string> = {
  available: 'bg-green-500',
  sold_out: 'bg-red-500',
  tomorrow: 'bg-amber-500',
}

interface CatchItem { id: string; name: string; status: string }

export function CatchWidget({ items }: { items: CatchItem[] }) {
  return (
    <div className="bg-surface border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-semibold text-[#1a2e1a]">Today's Catch</p>
        <Link href="/dashboard/catch" className="text-xs text-[#c8956c] hover:underline">Manage →</Link>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {items.map(item => (
          <div key={item.id} className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_DOT[item.status] ?? 'bg-gray-300'}`} />
            <span className="text-sm text-[#1a2e1a] truncate">{item.name}</span>
          </div>
        ))}
        {items.length === 0 && <p className="text-sm text-text-muted col-span-2">No catch items today</p>}
      </div>
    </div>
  )
}
