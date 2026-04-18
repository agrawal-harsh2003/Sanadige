'use client'
import { useState, useTransition } from 'react'
import { addStaff } from '@/actions/staff'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger,
} from '@/components/ui/drawer'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

export function AddStaffDrawer() {
  const [open, setOpen] = useState(false)
  const [role, setRole] = useState('host')
  const [, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      await addStaff({
        name: fd.get('name') as string,
        phone: fd.get('phone') as string,
        role,
      })
      setOpen(false)
    })
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button className="bg-primary hover:bg-primary/90 text-white">+ Add Staff</Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader><DrawerTitle>Add Staff Member</DrawerTitle></DrawerHeader>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div><Label>Name</Label><Input name="name" required className="mt-1" /></div>
          <div><Label>WhatsApp phone</Label><Input name="phone" type="tel" required className="mt-1" /></div>
          <div>
            <Label>Role</Label>
            <Select value={role} onValueChange={v => { if (v) setRole(v) }}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {['manager', 'chef', 'host'].map(r => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" className="w-full bg-primary text-white">Add Member</Button>
        </form>
      </DrawerContent>
    </Drawer>
  )
}
