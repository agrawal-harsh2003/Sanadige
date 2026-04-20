import { Router } from 'express'
import { sendBookingConfirmationTemplate } from '../lib/whatsapp'

export const bookingsRouter = Router()

function floorLabel(f: string): string {
  const map: Record<string, string> = {
    terrace: 'Terrace',
    floor1: 'Floor 1',
    floor2: 'Floor 2',
    private: 'Private Room',
  }
  return map[f] ?? f
}

bookingsRouter.post('/confirm', async (req, res) => {
  try {
    const { phone, guest_name, booking_ref, datetime, party_size, floor } =
      req.body as {
        phone: string
        guest_name: string
        booking_ref: string
        datetime: string
        party_size: number
        floor: string
      }

    if (!phone || !guest_name || !booking_ref || !datetime) {
      return res.status(400).json({ ok: false, error: 'Missing required fields' })
    }

    const dt = new Date(datetime)
    const date = dt.toLocaleDateString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
    const time = dt.toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    })

    const digits = phone.replace(/\D/g, '')
    const normalized = digits.length === 10 ? `91${digits}` : digits

    await sendBookingConfirmationTemplate(normalized, {
      name: guest_name,
      date,
      time,
      party: String(party_size),
      floor: floorLabel(floor),
      ref: booking_ref,
    })

    console.log(`[bookings] Confirmation sent to ${normalized} for ${booking_ref}`)
    res.json({ ok: true })
  } catch (err) {
    console.error('[bookings] confirm error:', err)
    res.json({ ok: true })
  }
})
