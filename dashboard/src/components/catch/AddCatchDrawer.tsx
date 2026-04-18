'use client'
import { useState, useTransition } from 'react'
import { addCatch } from '@/actions/catch'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger,
} from '@/components/ui/drawer'

export function AddCatchDrawer() {
  const [open, setOpen] = useState(false)
  const [, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const preps = (fd.get('preps') as string).split(',').map(s => s.trim()).filter(Boolean)
    startTransition(async () => {
      await addCatch({
        name: fd.get('name') as string,
        origin_region: fd.get('region') as string,
        recommended_preps: preps,
        spice_level: Number(fd.get('spice')),
      })
      setOpen(false)
    })
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button className="bg-primary hover:bg-primary/90 text-white">+ Add Item</Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader><DrawerTitle>Add Catch Item</DrawerTitle></DrawerHeader>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div><Label>Fish name</Label><Input name="name" required className="mt-1" /></div>
          <div><Label>Region</Label><Input name="region" required className="mt-1" /></div>
          <div><Label>Preps (comma-separated)</Label><Input name="preps" placeholder="Tawa Fry, Curry" className="mt-1" /></div>
          <div><Label>Spice level (1–5)</Label><Input name="spice" type="number" min={1} max={5} defaultValue={3} className="mt-1" /></div>
          <Button type="submit" className="w-full bg-primary text-white">Add</Button>
        </form>
      </DrawerContent>
    </Drawer>
  )
}
