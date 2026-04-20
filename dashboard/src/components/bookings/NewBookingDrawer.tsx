'use client'
import { useState, useTransition } from 'react'
import { createBooking } from '@/actions/bookings'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DateTimePicker } from '@/components/ui/date-time-picker'
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger,
} from '@/components/ui/drawer'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

const FLOORS = [
  { value: 'terrace', label: 'Terrace' },
  { value: 'floor1', label: 'Floor 1' },
  { value: 'floor2', label: 'Floor 2' },
  { value: 'private', label: 'Private Room' },
]

export function NewBookingDrawer() {
  const [open, setOpen] = useState(false)
  const [floor, setFloor] = useState('terrace')
  const [dateTime, setDateTime] = useState<Date | undefined>(undefined)
  const [, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!dateTime) return
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      await createBooking({
        guest_name: fd.get('guest_name') as string,
        phone: fd.get('phone') as string,
        party_size: Number(fd.get('party_size')),
        datetime: dateTime.toISOString(),
        floor,
        special_notes: (fd.get('notes') as string) || undefined,
      })
      setOpen(false)
      setDateTime(undefined)
    })
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold">+ New Booking</Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>New Booking</DrawerTitle>
        </DrawerHeader>
        <div className="overflow-y-auto max-h-[60vh] px-6 pb-6" data-vaul-no-drag>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label className="font-medium">Guest name</Label>
              <Input name="guest_name" required className="mt-1.5" placeholder="Rahul Sharma" />
            </div>
            <div>
              <Label className="font-medium">Phone (WhatsApp)</Label>
              <Input name="phone" type="tel" required className="mt-1.5" placeholder="+91 98765 43210" />
            </div>
            <div>
              <Label className="font-medium">Party size</Label>
              <Input name="party_size" type="number" min={1} max={50} required className="mt-1.5" placeholder="2" />
            </div>
            <div>
              <Label className="font-medium">Date &amp; time</Label>
              <div className="mt-1.5">
                <DateTimePicker
                  value={dateTime}
                  onChange={setDateTime}
                  placeholder="Choose date & time"
                />
              </div>
            </div>
            <div>
              <Label className="font-medium">Floor</Label>
              <Select value={floor} onValueChange={(v) => { if (v) setFloor(v) }}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FLOORS.map(f => (
                    <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="font-medium">Special notes</Label>
              <Input name="notes" className="mt-1.5" placeholder="Allergy, occasion, seating preference…" />
            </div>
            <Button
              type="submit"
              disabled={!dateTime}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold h-11 mt-2 disabled:opacity-50"
            >
              Create Booking
            </Button>
          </form>
        </div>
      </DrawerContent>
    </Drawer>
  )
}
