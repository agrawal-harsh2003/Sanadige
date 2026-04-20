import Link from 'next/link'

const STATUS_DOT: Record<string, string> = {
  available: 'bg-emerald-500',
  sold_out: 'bg-rose-500',
  tomorrow: 'bg-amber-500',
}

interface CatchItem { id: string; name: string; status: string }

export function CatchWidget({ items }: { items: CatchItem[] }) {
  return (
    <div className="bg-card shadow-sm ring-1 ring-black/5 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-semibold text-foreground">Today's Catch</p>
        <Link href="/dashboard/catch" className="text-xs text-accent hover:underline font-medium">Manage →</Link>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {items.map(item => (
          <div key={item.id} className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_DOT[item.status] ?? 'bg-muted-foreground'}`} />
            <span className="text-sm text-foreground truncate">{item.name}</span>
          </div>
        ))}
        {items.length === 0 && <p className="text-sm text-muted-foreground col-span-2">No catch items today</p>}
      </div>
    </div>
  )
}
