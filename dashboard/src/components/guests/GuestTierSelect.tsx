'use client'
import { useTransition } from 'react'
import { updateGuestTier } from '@/actions/guests'

export function GuestTierSelect({ guestId, currentTier }: { guestId: string; currentTier: string }) {
  const [, startTransition] = useTransition()

  return (
    <select
      defaultValue={currentTier}
      onChange={e => startTransition(() => updateGuestTier(guestId, e.target.value as 'standard' | 'preferred' | 'vip'))}
      className="h-9 rounded-lg border border-border bg-background px-3 text-sm capitalize"
    >
      <option value="standard">Standard</option>
      <option value="preferred">Preferred</option>
      <option value="vip">VIP</option>
    </select>
  )
}
