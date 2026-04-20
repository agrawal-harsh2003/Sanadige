'use client'
import { useOptimistic, useTransition, useRef } from 'react'
import { MapPin } from 'lucide-react'
import { toggleCatch, updateNote } from '@/actions/catch'

type Status = 'available' | 'sold_out' | 'tomorrow'

const STATUS_CONFIG: Record<Status, { label: string; border: string; badge: string }> = {
  available: {
    label: 'Available',
    border: 'border-l-emerald-500',
    badge: 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200',
  },
  sold_out: {
    label: 'Sold Out',
    border: 'border-l-rose-500',
    badge: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200',
  },
  tomorrow: {
    label: 'Tomorrow',
    border: 'border-l-amber-500',
    badge: 'bg-amber-50 text-amber-800 ring-1 ring-amber-200',
  },
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
    <div className={`bg-card shadow-sm ring-1 ring-black/5 border-l-4 ${config.border} rounded-2xl p-5 space-y-4 hover:shadow-md transition-shadow`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="font-semibold text-foreground text-base">{name}</p>
          <p className="text-xs text-muted-foreground italic flex items-center gap-1 mt-0.5">
            <MapPin size={10} className="inline" />{origin_region}
          </p>
        </div>
        <button
          onClick={cycleStatus}
          className={`text-xs font-semibold px-3 py-1 rounded-full transition-opacity hover:opacity-80 ${config.badge}`}
        >
          {config.label}
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {recommended_preps.map(p => (
          <span key={p} className="text-xs bg-muted text-muted-foreground px-2.5 py-0.5 rounded-full">
            {p}
          </span>
        ))}
      </div>
      <textarea
        ref={noteRef}
        defaultValue={notes ?? ''}
        onBlur={handleNoteBlur}
        placeholder="Add a chef's note…"
        className="w-full text-sm text-foreground bg-muted/50 border border-border rounded-xl p-3 resize-none h-16 focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/50"
      />
    </div>
  )
}
