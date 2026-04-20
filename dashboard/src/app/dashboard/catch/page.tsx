import { getSupabase } from '@/lib/supabase'
import { CatchCard } from '@/components/catch/CatchCard'
import { AddCatchDrawer } from '@/components/catch/AddCatchDrawer'

async function getCatchData() {
  const supabase = getSupabase()
  const today = new Date().toISOString().split('T')[0]

  const { data } = await supabase
    .from('daily_availability')
    .select('id, status, notes, catch_items(id, name, origin_region, recommended_preps)')
    .eq('date', today)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((r: any) => ({
    id: r.catch_items?.id ?? r.id,
    name: r.catch_items?.name ?? 'Unknown',
    origin_region: r.catch_items?.origin_region ?? '',
    recommended_preps: r.catch_items?.recommended_preps ?? [],
    status: r.status as 'available' | 'sold_out' | 'tomorrow',
    notes: r.notes as string | null,
  }))
}

export default async function CatchPage() {
  const items = await getCatchData()
  const available = items.filter(i => i.status === 'available').length
  const soldOut = items.filter(i => i.status === 'sold_out').length
  const tomorrow = items.filter(i => i.status === 'tomorrow').length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">Today's Catch</h1>
        <AddCatchDrawer />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Available', value: available },
          { label: 'Sold Out', value: soldOut },
          { label: 'Tomorrow', value: tomorrow },
          { label: 'Total Items', value: items.length },
        ].map(m => (
          <div key={m.label} className="bg-card shadow-sm ring-1 ring-black/5 rounded-2xl p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{m.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{m.label}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {items.map(item => (
          <CatchCard key={item.id} {...item} />
        ))}
        {items.length === 0 && (
          <p className="text-muted-foreground col-span-2 text-center py-12">No catch items for today. Add one above.</p>
        )}
      </div>
    </div>
  )
}
