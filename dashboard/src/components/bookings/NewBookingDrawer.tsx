'use client'
import { useState, useTransition } from 'react'
import { createBooking } from '@/actions/bookings'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger,
} from '@/components/ui/drawer'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

export function NewBookingDrawer() {
  const [open, setOpen] = useState(false)
  const [floor, setFloor] = useState('terrace')
  const [, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      await createBooking({
        guest_name: fd.get('guest_name') as string,
        phone: fd.get('phone') as string,
        party_size: Number(fd.get('party_size')),
        datetime: fd.get('datetime') as string,
        floor,
        special_notes: (fd.get('notes') as string) || undefined,
      })
      setOpen(false)
    })
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button className="bg-primary hover:bg-primary/90 text-white">+ New Booking</Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader><DrawerTitle>New Booking</DrawerTitle></DrawerHeader>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div><Label>Guest name</Label><Input name="guest_name" required className="mt-1" /></div>
          <div><Label>Phone (WhatsApp)</Label><Input name="phone" type="tel" required className="mt-1" /></div>
          <div><Label>Party size</Label><Input name="party_size" type="number" min={1} max={50} required className="mt-1" /></div>
          <div><Label>Date &amp; time</Label><Input name="datetime" type="datetime-local" required className="mt-1" /></div>
          <div>
            <Label>Floor</Label>
            <Select value={floor} onValueChange={(v) => { if (v) setFloor(v) }}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {['terrace', 'floor1', 'floor2', 'private'].map(f => (
                  <SelectItem key={f} value={f}>{f}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Special notes</Label><Input name="notes" className="mt-1" /></div>
          <Button type="submit" className="w-full bg-primary text-white">Create Booking</Button>
        </form>
      </DrawerContent>
    </Drawer>
  )
}
