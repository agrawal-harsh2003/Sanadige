'use client'
import { useOptimistic, useTransition, useRef } from 'react'
import { toggleCatch, updateNote } from '@/actions/catch'

type Status = 'available' | 'sold_out' | 'tomorrow'

const STATUS_CONFIG: Record<Status, { label: string; border: string; badge: string }> = {
  available: { label: 'Available', border: 'border-l-green-500', badge: 'bg-green-100 text-green-800' },
  sold_out: { label: 'Sold Out', border: 'border-l-red-500', badge: 'bg-red-100 text-red-800' },
  tomorrow: { label: 'Tomorrow', border: 'border-l-amber-500', badge: 'bg-amber-100 text-amber-800' },
}

interface CatchCardProps {
  id: string
  name: string
  origin_region: string
  recommended_preps: string[]
  status: Status
  notes: string | null
}

export function CatchCard({ id, name, origin_region, recommended_preps, status, notes }: CatchCardProps) {
  const [optimisticStatus, setOptimisticStatus] = useOptimistic(status)
  const [, startTransition] = useTransition()
  const noteRef = useRef<HTMLTextAreaElement>(null)
  const config = STATUS_CONFIG[optimisticStatus]

  function cycleStatus() {
    const next: Status =
      optimisticStatus === 'available' ? 'sold_out' :
      optimisticStatus === 'sold_out' ? 'tomorrow' : 'available'
    startTransition(async () => {
      setOptimisticStatus(next)
      await toggleCatch(id, next)
    })
  }

  function handleNoteBlur() {
    const note = noteRef.current?.value ?? ''
    startTransition(() => updateNote(id, note))
  }

  return (
    <div className={`bg-surface border border-border border-l-4 ${config.border} rounded-xl p-4 space-y-3`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="font-semibold text-[#1a2e1a]">{name}</p>
          <p className="text-xs text-text-muted">{origin_region}</p>
        </div>
        <button
          onClick={cycleStatus}
          className={`text-xs font-semibold px-2.5 py-1 rounded-full ${config.badge}`}
        >
          {config.label}
        </button>
      </div>
      <div className="flex flex-wrap gap-1">
        {recommended_preps.map(p => (
          <span key={p} className="text-xs bg-background px-2 py-0.5 rounded-full border border-border text-[#1a2e1a]">
            {p}
          </span>
        ))}
      </div>
      <textarea
        ref={noteRef}
        defaultValue={notes ?? ''}
        onBlur={handleNoteBlur}
        placeholder="Add a note…"
        className="w-full text-sm text-[#1a2e1a] bg-background border border-border rounded-lg p-2 resize-none h-16 focus:outline-none focus:ring-1 focus:ring-primary"
      />
    </div>
  )
}
