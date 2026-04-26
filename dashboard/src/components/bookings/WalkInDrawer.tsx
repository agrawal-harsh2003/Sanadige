'use client'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger, DrawerDescription,
} from '@/components/ui/drawer'
import { createWalkIn } from '@/actions/bookings'

export function WalkInDrawer() {
  const [open, setOpen] = useState(false)
  const [result, setResult] = useState<{ floor: string; table: string } | null>(null)
  const [noSlot, setNoSlot] = useState(false)
  const [, startTransition] = useTransition()

  function reset() {
    setResult(null)
    setNoSlot(false)
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const r = await createWalkIn({
        guest_name: fd.get('guest_name') as string,
        phone: fd.get('phone') as string,
        party_size: Number(fd.get('party_size')),
      })
      if (r.ok) setResult({ floor: r.floor!, table: r.table! })
      else setNoSlot(true)
    })
  }

  return (
    <Drawer open={open} onOpenChange={v => { setOpen(v); if (!v) reset() }}>
      <DrawerTrigger asChild>
        <Button variant="outline">+ Walk-in</Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Walk-in Guest</DrawerTitle>
          <DrawerDescription className="sr-only">Record a walk-in booking</DrawerDescription>
        </DrawerHeader>
        <div className="px-6 pb-6 max-h-[60vh] overflow-y-auto" data-vaul-no-drag>
          {result ? (
            <div className="text-center py-8 space-y-3">
              <div className="text-4xl">✅</div>
              <p className="text-lg font-bold text-foreground">Guest Seated</p>
              <p className="text-muted-foreground">
                Assigned to <strong>{result.table}</strong> on <strong>{result.floor}</strong>
              </p>
              <Button className="w-full mt-4" onClick={() => { setOpen(false); reset() }}>Done</Button>
            </div>
          ) : noSlot ? (
            <div className="text-center py-8 space-y-3">
              <div className="text-4xl">😔</div>
              <p className="text-lg font-bold text-foreground">No Slot Available</p>
              <p className="text-muted-foreground text-sm">No available tables found for this party size right now.</p>
              <Button variant="outline" className="w-full mt-4" onClick={() => { setNoSlot(false) }}>Try Again</Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label className="font-medium">Guest name</Label>
                <Input name="guest_name" required className="mt-1.5" placeholder="Name" />
              </div>
              <div>
                <Label className="font-medium">Phone</Label>
                <Input name="phone" type="tel" required className="mt-1.5" placeholder="+91 98765 43210" />
              </div>
              <div>
                <Label className="font-medium">Party size</Label>
                <Input name="party_size" type="number" min={1} max={20} required className="mt-1.5" placeholder="2" />
              </div>
              <Button type="submit" className="w-full h-11 mt-2">Find Best Table & Seat</Button>
            </form>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  )
}
