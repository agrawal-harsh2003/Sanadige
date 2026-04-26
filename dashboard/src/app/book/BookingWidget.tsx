'use client'
import { useState } from 'react'

const FLOORS = [
  { value: 'any',     label: 'No preference' },
  { value: 'terrace', label: 'Terrace' },
  { value: 'floor1',  label: 'Floor 1 (Indoor)' },
  { value: 'floor2',  label: 'Floor 2 (Indoor)' },
  { value: 'private', label: 'Private Dining Room' },
]
const OCCASIONS = ['Birthday', 'Anniversary', 'Business Dinner', 'Date Night', 'Family Gathering', 'Other']

interface Slot { time: string; iso: string; service: string }

type Step = 'date' | 'slot' | 'details' | 'confirm'

export function BookingWidget() {
  const [step, setStep] = useState<Step>('date')
  const [date, setDate] = useState('')
  const [partySize, setPartySize] = useState(2)
  const [floor, setFloor] = useState('any')
  const [slots, setSlots] = useState<Slot[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null)
  const [details, setDetails] = useState({ name: '', phone: '', email: '', occasion: '', notes: '' })
  const [booking, setBooking] = useState<{ booking_ref: string } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function searchSlots() {
    if (!date) return
    setLoadingSlots(true)
    setError('')
    try {
      const res = await fetch(`/api/availability?date=${date}&party_size=${partySize}&floor=${floor}`)
      const data = await res.json()
      if (data.closed) { setSlots([]); setError('We are closed on this date.') }
      else { setSlots(data.slots ?? []) }
      setStep('slot')
    } catch {
      setError('Could not fetch availability. Please try again.')
    } finally {
      setLoadingSlots(false)
    }
  }

  async function confirmBooking() {
    if (!selectedSlot) return
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/hold', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guest_name: details.name,
          phone: details.phone,
          email: details.email || undefined,
          party_size: partySize,
          datetime: selectedSlot.iso,
          floor: floor === 'any' ? 'terrace' : floor,
          occasion: details.occasion || undefined,
          special_notes: details.notes || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setBooking({ booking_ref: data.booking_ref })
      setStep('confirm')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong.')
    } finally {
      setSubmitting(false)
    }
  }

  const lunchSlots  = slots.filter(s => s.service === 'lunch')
  const dinnerSlots = slots.filter(s => s.service === 'dinner')

  if (step === 'confirm' && booking) {
    return (
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm ring-1 ring-black/5 p-8 text-center space-y-4">
        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-3xl">✅</div>
        <h2 className="text-2xl font-bold text-[#1a3a38]">Booking Requested</h2>
        <p className="text-[#8a7f75]">Your table has been held for 15 minutes pending confirmation from our team.</p>
        <div className="bg-[#f8f3ec] rounded-xl p-4 text-left space-y-1.5 text-sm">
          <p><span className="text-[#8a7f75]">Name:</span> <strong>{details.name}</strong></p>
          <p><span className="text-[#8a7f75]">Date:</span> <strong>{date}</strong> at <strong>{selectedSlot?.time}</strong></p>
          <p><span className="text-[#8a7f75]">Party:</span> <strong>{partySize} guests</strong></p>
          <p><span className="text-[#8a7f75]">Ref:</span> <strong className="text-[#1a3a38]">{booking.booking_ref}</strong></p>
        </div>
        <p className="text-sm text-[#8a7f75]">We will send a WhatsApp confirmation to <strong>{details.phone}</strong> shortly.</p>
      </div>
    )
  }

  return (
    <div className="w-full max-w-lg space-y-4">
      {/* Progress */}
      <div className="flex items-center gap-2 text-xs text-[#8a7f75] mb-2">
        {(['date', 'slot', 'details'] as Step[]).map((s, i) => (
          <span key={s} className="flex items-center gap-2">
            <span className={`font-semibold ${step === s ? 'text-[#1a3a38]' : ''}`}>
              {i + 1}. {s.charAt(0).toUpperCase() + s.slice(1)}
            </span>
            {i < 2 && <span>›</span>}
          </span>
        ))}
      </div>

      {/* Step: Date + Party */}
      <div className="bg-white rounded-2xl shadow-sm ring-1 ring-black/5 p-6 space-y-5">
        <h2 className="text-lg font-bold text-[#1a3a38]">When would you like to visit?</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-[#2c2925] mb-1.5">Date</label>
            <input
              type="date"
              value={date}
              min={new Date().toISOString().split('T')[0]}
              onChange={e => { setDate(e.target.value); setStep('date'); setSlots([]); setSelectedSlot(null) }}
              className="w-full px-3 py-2 text-sm border border-[#e0d9d0] rounded-lg bg-[#f8f3ec] focus:outline-none focus:ring-2 focus:ring-[#1a3a38]/20"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#2c2925] mb-1.5">Guests</label>
            <select
              value={partySize}
              onChange={e => { setPartySize(Number(e.target.value)); setStep('date'); setSlots([]); setSelectedSlot(null) }}
              className="w-full px-3 py-2 text-sm border border-[#e0d9d0] rounded-lg bg-[#f8f3ec] focus:outline-none focus:ring-2 focus:ring-[#1a3a38]/20"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map(n => (
                <option key={n} value={n}>{n} {n === 1 ? 'guest' : 'guests'}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#2c2925] mb-1.5">Seating preference</label>
          <select
            value={floor}
            onChange={e => { setFloor(e.target.value); setStep('date'); setSlots([]); setSelectedSlot(null) }}
            className="w-full px-3 py-2 text-sm border border-[#e0d9d0] rounded-lg bg-[#f8f3ec] focus:outline-none focus:ring-2 focus:ring-[#1a3a38]/20"
          >
            {FLOORS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </div>
        <button
          onClick={searchSlots}
          disabled={!date || loadingSlots}
          className="w-full py-3 rounded-xl bg-[#1a3a38] text-white font-semibold text-sm hover:bg-[#1a3a38]/90 disabled:opacity-50 transition-colors"
        >
          {loadingSlots ? 'Checking availability…' : 'See Available Times'}
        </button>
        {error && <p className="text-sm text-red-600 text-center">{error}</p>}
      </div>

      {/* Step: Slot selection */}
      {step !== 'date' && slots.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm ring-1 ring-black/5 p-6 space-y-4">
          <h2 className="text-lg font-bold text-[#1a3a38]">Choose a time</h2>
          {lunchSlots.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-[#8a7f75] uppercase tracking-wider mb-2">Lunch</p>
              <div className="flex flex-wrap gap-2">
                {lunchSlots.map(s => (
                  <button key={s.iso} onClick={() => { setSelectedSlot(s); setStep('details') }}
                    className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${selectedSlot?.iso === s.iso ? 'bg-[#1a3a38] text-white border-[#1a3a38]' : 'border-[#e0d9d0] text-[#2c2925] hover:border-[#1a3a38]/40'}`}>
                    {s.time}
                  </button>
                ))}
              </div>
            </div>
          )}
          {dinnerSlots.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-[#8a7f75] uppercase tracking-wider mb-2">Dinner</p>
              <div className="flex flex-wrap gap-2">
                {dinnerSlots.map(s => (
                  <button key={s.iso} onClick={() => { setSelectedSlot(s); setStep('details') }}
                    className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${selectedSlot?.iso === s.iso ? 'bg-[#1a3a38] text-white border-[#1a3a38]' : 'border-[#e0d9d0] text-[#2c2925] hover:border-[#1a3a38]/40'}`}>
                    {s.time}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {step !== 'date' && slots.length === 0 && !loadingSlots && !error && (
        <div className="bg-white rounded-2xl shadow-sm ring-1 ring-black/5 p-6 text-center text-[#8a7f75] text-sm">
          No available slots for this date and party size. Please try a different date.
        </div>
      )}

      {/* Step: Guest details */}
      {step === 'details' && selectedSlot && (
        <div className="bg-white rounded-2xl shadow-sm ring-1 ring-black/5 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-[#1a3a38]">Your details</h2>
            <div className="text-sm text-[#8a7f75]">{selectedSlot.time} · {partySize} guests</div>
          </div>
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#2c2925] mb-1.5">Full name *</label>
              <input value={details.name} onChange={e => setDetails(d => ({ ...d, name: e.target.value }))}
                placeholder="Rahul Sharma" required
                className="w-full px-3 py-2 text-sm border border-[#e0d9d0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a3a38]/20" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#2c2925] mb-1.5">WhatsApp number *</label>
              <input value={details.phone} onChange={e => setDetails(d => ({ ...d, phone: e.target.value }))}
                type="tel" placeholder="+91 98765 43210" required
                className="w-full px-3 py-2 text-sm border border-[#e0d9d0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a3a38]/20" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#2c2925] mb-1.5">Email (optional)</label>
              <input value={details.email} onChange={e => setDetails(d => ({ ...d, email: e.target.value }))}
                type="email" placeholder="rahul@example.com"
                className="w-full px-3 py-2 text-sm border border-[#e0d9d0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a3a38]/20" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#2c2925] mb-1.5">Occasion (optional)</label>
              <select value={details.occasion} onChange={e => setDetails(d => ({ ...d, occasion: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-[#e0d9d0] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#1a3a38]/20">
                <option value="">None</option>
                {OCCASIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#2c2925] mb-1.5">Special requests (optional)</label>
              <textarea value={details.notes} onChange={e => setDetails(d => ({ ...d, notes: e.target.value }))}
                rows={2} placeholder="Dietary requirements, allergies, seating preferences…"
                className="w-full px-3 py-2 text-sm border border-[#e0d9d0] rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[#1a3a38]/20" />
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            onClick={confirmBooking}
            disabled={!details.name || !details.phone || submitting}
            className="w-full py-3 rounded-xl bg-[#1a3a38] text-white font-semibold text-sm hover:bg-[#1a3a38]/90 disabled:opacity-50 transition-colors"
          >
            {submitting ? 'Confirming…' : 'Request Booking'}
          </button>
          <p className="text-[11px] text-[#8a7f75] text-center">Our team will confirm via WhatsApp within a few minutes.</p>
        </div>
      )}
    </div>
  )
}
