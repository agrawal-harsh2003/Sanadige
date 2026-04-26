'use client'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { saveServiceConfig } from '@/actions/settings'

interface Props {
  date: string
  config: { cover_cap?: number; walkin_allocation_pct?: number; is_closed?: boolean; notes?: string } | null
}

export function ServiceConfigForm({ date, config }: Props) {
  const [coverCap, setCoverCap] = useState(String(config?.cover_cap ?? 60))
  const [walkinPct, setWalkinPct] = useState(String(config?.walkin_allocation_pct ?? 10))
  const [isClosed, setIsClosed] = useState(config?.is_closed ?? false)
  const [notes, setNotes] = useState(config?.notes ?? '')
  const [saved, setSaved] = useState(false)
  const [, startTransition] = useTransition()

  function handleSave() {
    startTransition(async () => {
      await saveServiceConfig({
        date,
        cover_cap: Number(coverCap),
        walkin_allocation_pct: Number(walkinPct),
        is_closed: isClosed,
        notes,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    })
  }

  return (
    <div className="space-y-5">
      <div>
        <label className="block text-xs font-semibold text-foreground mb-1.5">Date</label>
        <input
          type="date"
          value={date}
          readOnly
          className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-muted/30 text-muted-foreground cursor-default"
        />
        <p className="text-[10px] text-muted-foreground mt-1">Use ?date=YYYY-MM-DD in the URL to configure a different date</p>
      </div>

      <div className="flex gap-3">
        <div className="flex-1">
          <label className="block text-xs font-semibold text-foreground mb-1.5">Cover Cap</label>
          <input
            type="number"
            min={1}
            max={200}
            value={coverCap}
            onChange={e => setCoverCap(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div className="flex-1">
          <label className="block text-xs font-semibold text-foreground mb-1.5">Walk-in Hold %</label>
          <input
            type="number"
            min={0}
            max={30}
            value={walkinPct}
            onChange={e => setWalkinPct(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-foreground mb-1.5">Notes (optional)</label>
        <textarea
          rows={2}
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Special event, private party note…"
          className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      <div className="flex items-center gap-3 p-3 rounded-lg bg-rose-50 ring-1 ring-rose-200">
        <input
          id="closed"
          type="checkbox"
          checked={isClosed}
          onChange={e => setIsClosed(e.target.checked)}
          className="accent-rose-600"
        />
        <label htmlFor="closed" className="text-sm font-medium text-rose-700 cursor-pointer">
          Close service for this date (no new bookings)
        </label>
      </div>

      <Button onClick={handleSave} className="w-full">
        {saved ? 'Saved ✓' : 'Save Configuration'}
      </Button>
    </div>
  )
}
