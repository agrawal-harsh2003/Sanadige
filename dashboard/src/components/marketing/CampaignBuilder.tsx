'use client'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { sendCampaign } from '@/actions/marketing'

const SEGMENTS = [
  { value: 'lapsed',    label: 'Lapsed guests (90+ days since last visit)' },
  { value: 'birthday',  label: 'Guests with upcoming birthday (next 14 days)' },
  { value: 'vip',       label: 'VIP guests' },
  { value: 'preferred', label: 'Preferred guests' },
  { value: 'custom',    label: 'All opted-in guests' },
]

export function CampaignBuilder() {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [segment, setSegment] = useState('lapsed')
  const [message, setMessage] = useState('')
  const [result, setResult] = useState<{ sent: number } | null>(null)
  const [, startTransition] = useTransition()

  function handleSend() {
    if (!name.trim() || !message.trim()) return
    startTransition(async () => {
      const r = await sendCampaign({ name, segment_type: segment, message })
      setResult(r)
    })
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)}>
        + New Campaign
      </Button>
    )
  }

  if (result) {
    return (
      <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
        <div className="bg-card rounded-2xl shadow-xl p-8 max-w-sm w-full text-center space-y-4">
          <div className="text-4xl">✅</div>
          <p className="text-xl font-bold text-foreground">Campaign Sent</p>
          <p className="text-muted-foreground">WhatsApp messages sent to <strong>{result.sent}</strong> guests.</p>
          <Button onClick={() => { setOpen(false); setResult(null); setName(''); setMessage('') }} className="w-full">Done</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl shadow-xl p-6 max-w-lg w-full space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">New Campaign</h2>
          <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground text-xl leading-none">×</button>
        </div>

        <div>
          <label className="block text-xs font-semibold text-foreground mb-1.5">Campaign Name</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Monsoon Special"
            className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-foreground mb-1.5">Target Segment</label>
          <select
            value={segment}
            onChange={e => setSegment(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            {SEGMENTS.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-foreground mb-1.5">Message</label>
          <textarea
            rows={4}
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="Hi {name}, we miss you at Sanadige! Come back and…"
            className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <p className="text-[10px] text-muted-foreground mt-1">Use {'{name}'} to personalise with guest name.</p>
        </div>

        <div className="flex gap-3">
          <Button variant="outline" onClick={() => setOpen(false)} className="flex-1">Cancel</Button>
          <Button onClick={handleSend} className="flex-1" disabled={!name.trim() || !message.trim()}>Send Now</Button>
        </div>
      </div>
    </div>
  )
}
