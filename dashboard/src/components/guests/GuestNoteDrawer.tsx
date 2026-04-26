'use client'
import { useState, useTransition } from 'react'
import { Drawer } from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import { addGuestNote } from '@/actions/guests'

export function GuestNoteDrawer({ guestId, staffName }: { guestId: string; staffName: string }) {
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState('')
  const [pending, startTransition] = useTransition()

  function submit() {
    if (!note.trim()) return
    startTransition(async () => {
      await addGuestNote(guestId, note.trim())
      setNote('')
      setOpen(false)
    })
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)} className="text-xs">+ Add Note</Button>
      <Drawer open={open} onOpenChange={setOpen}>
        <div className="p-6 space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Add Staff Note</h2>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="e.g. Prefers a quieter corner, knows the sommelier…"
            rows={4}
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <Button onClick={submit} disabled={pending || !note.trim()} className="w-full">
            {pending ? 'Saving…' : 'Save Note'}
          </Button>
        </div>
      </Drawer>
    </>
  )
}
