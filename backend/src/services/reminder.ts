import cron from 'node-cron'
import { supabase } from '../lib/supabase'
import { sendWhatsAppMessage, sendButtons } from '../lib/whatsapp'
import { getTodayCatch } from '../tools/get-today-catch'

// ── Helpers ────────────────────────────────────────────────────────────────────

const floorLabel: Record<string, string> = {
  terrace: 'Terrace',
  floor1: 'Floor 1',
  floor2: 'Floor 2',
  private: 'Private Dining Room',
}

function fmtTimeIST(isoString: string): string {
  const d = new Date(isoString)
  const ist = new Date(d.getTime() + 5.5 * 60 * 60 * 1000)
  const h = ist.getUTCHours()
  const m = ist.getUTCMinutes()
  const ampm = h >= 12 ? 'PM' : 'AM'
  return `${(h % 12 || 12)}:${m.toString().padStart(2, '0')} ${ampm}`
}

async function getCatchSummary(): Promise<string> {
  try {
    const catchText = await getTodayCatch()
    const lines = catchText.split('\n').slice(1)
    const available = lines
      .filter(l => l.includes('available'))
      .map(l => l.split('(')[0].replace('-', '').trim())
    return available.length > 0 ? `\n\nTonight's fresh catch: ${available.join(', ')} 🐟` : ''
  } catch {
    return ''
  }
}

// ── 2-Hour Booking Reminder to Guest ──────────────────────────────────────────

async function sendBookingReminders(): Promise<void> {
  const now = new Date()
  const windowStart = new Date(now.getTime() + 110 * 60 * 1000).toISOString()
  const windowEnd = new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString()

  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('id, booking_ref, guest_name, whatsapp_id, datetime, floor, party_size')
    .eq('status', 'confirmed')
    .is('reminder_sent_at', null)
    .gte('datetime', windowStart)
    .lt('datetime', windowEnd)

  if (error) {
    console.error('[reminder] Booking reminder query error:', error.message)
    return
  }
  if (!bookings || bookings.length === 0) return

  const catchSummary = await getCatchSummary()

  for (const booking of bookings) {
    const localTime = fmtTimeIST(booking.datetime)
    const message = [
      `🌊 Your table at *Sanadige* is in 2 hours!`,
      ``,
      `📅 *Tonight · ${localTime}*`,
      `👥 ${booking.party_size} guests · ${floorLabel[booking.floor] ?? booking.floor}`,
      `🔖 Ref: ${booking.booking_ref}`,
      catchSummary,
      ``,
      `Need to change or cancel? Reply *cancel* or call us at +91 91678 85275.`,
      `We look forward to seeing you! 🙏`,
    ].join('\n')

    try {
      await sendWhatsAppMessage(booking.whatsapp_id, message)
      await supabase
        .from('bookings')
        .update({ reminder_sent_at: new Date().toISOString() })
        .eq('id', booking.id)
      console.log(`[reminder] Reminder sent for ${booking.booking_ref}`)
    } catch (err) {
      console.error(`[reminder] Failed reminder for ${booking.booking_ref}:`, err)
    }
  }
}

// ── Post-Meal Feedback Request ─────────────────────────────────────────────────

async function sendPostMealFeedback(): Promise<void> {
  const now = new Date()
  // Target bookings that ended ~1–1.5h ago (assume ~90 min meal duration)
  const windowStart = new Date(now.getTime() - 150 * 60 * 1000).toISOString()
  const windowEnd = new Date(now.getTime() - 90 * 60 * 1000).toISOString()

  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('id, booking_ref, guest_name, whatsapp_id, datetime')
    .in('status', ['confirmed', 'seated'])
    .is('feedback_sent_at', null)
    .gte('datetime', windowStart)
    .lt('datetime', windowEnd)

  if (error) {
    // Column may not exist yet — fail silently
    if (!error.message.includes('feedback_sent_at')) {
      console.error('[reminder] Feedback query error:', error.message)
    }
    return
  }
  if (!bookings || bookings.length === 0) return

  for (const booking of bookings) {
    const message = [
      `🙏 Thank you for dining with us tonight, *${booking.guest_name}*!`,
      ``,
      `We hope your meal was everything you hoped for. 🌊`,
      ``,
      `How was your experience at Sanadige?`,
    ].join('\n')

    try {
      await sendButtons(booking.whatsapp_id, message, [
        { id: 'fb_excellent', title: '⭐⭐⭐⭐⭐ Exceptional' },
        { id: 'fb_good', title: '⭐⭐⭐⭐ Very Good' },
        { id: 'fb_ok', title: '💬 Leave feedback' },
      ])
      await supabase
        .from('bookings')
        .update({ feedback_sent_at: new Date().toISOString() })
        .eq('id', booking.id)
      console.log(`[reminder] Feedback request sent for ${booking.booking_ref}`)
    } catch (err) {
      console.error(`[reminder] Failed feedback for ${booking.booking_ref}:`, err)
    }
  }
}

// ── Staff Evening Briefing (sent once at 5 PM IST) ────────────────────────────

async function sendEveningBriefing(): Promise<void> {
  const today = new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().split('T')[0]

  const [bookingsRes, staffRes] = await Promise.all([
    supabase
      .from('bookings')
      .select('party_size, datetime, floor, status')
      .gte('datetime', `${today}T00:00:00`)
      .lte('datetime', `${today}T23:59:59`)
      .eq('status', 'confirmed'),
    supabase
      .from('staff')
      .select('phone, role')
      .in('role', ['manager', 'host']),
  ])

  if (bookingsRes.error || !staffRes.data?.length) return

  const bookings = bookingsRes.data ?? []
  const totalCovers = bookings.reduce((s, b) => s + (b.party_size ?? 0), 0)
  const catchSummary = await getCatchSummary()

  // Find peak hour
  const hourCounts: Record<number, number> = {}
  bookings.forEach(b => {
    const h = new Date(b.datetime).getUTCHours() + 5  // rough IST hour
    hourCounts[h] = (hourCounts[h] ?? 0) + 1
  })
  const peakHour = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0]
  const peakStr = peakHour ? ` · Peak: ${peakHour[0]}:00 (${peakHour[1]} bookings)` : ''

  const floorBreakdown = ['terrace', 'floor1', 'floor2', 'private']
    .map(f => {
      const count = bookings.filter(b => b.floor === f).length
      return count > 0 ? `${floorLabel[f]}: ${count}` : null
    })
    .filter(Boolean)
    .join(' · ')

  const message = [
    `📊 *Evening Briefing — Tonight*`,
    ``,
    `📅 ${bookings.length} confirmed bookings · ${totalCovers} covers${peakStr}`,
    floorBreakdown ? `📍 ${floorBreakdown}` : '',
    catchSummary,
    ``,
    `Dashboard: dashboard.sanadige.in`,
  ].filter(l => l !== '').join('\n')

  for (const staff of staffRes.data) {
    try {
      await sendWhatsAppMessage(staff.phone, message)
    } catch (err) {
      console.error(`[reminder] Evening briefing failed for ${staff.phone}:`, err)
    }
  }
  console.log(`[reminder] Evening briefing sent to ${staffRes.data.length} staff`)
}

// ── New Booking Staff Alert (called from staff-menu after booking created) ─────

export async function notifyStaffOfBooking(params: {
  guestName: string
  partySize: number | string
  date: string
  time: string
  floor: string
  ref: string
  createdBy?: string
}): Promise<void> {
  const { data: staff } = await supabase
    .from('staff')
    .select('phone, role, name')
    .in('role', ['manager', 'host'])

  if (!staff?.length) return

  const message = [
    `📅 *New Booking Alert*`,
    ``,
    `👤 ${params.guestName} · ${params.partySize} guests`,
    `📅 ${params.date} · ${params.time}`,
    `📍 ${floorLabel[params.floor] ?? params.floor}`,
    `🔖 ${params.ref}`,
    params.createdBy ? `\nAdded by: ${params.createdBy}` : '',
  ].filter(l => l !== '').join('\n')

  for (const member of staff) {
    try {
      await sendWhatsAppMessage(member.phone, message)
    } catch (err) {
      console.error(`[reminder] Staff booking alert failed for ${member.phone}:`, err)
    }
  }
}

// ── Cancellation Alert ─────────────────────────────────────────────────────────

export async function notifyStaffOfCancellation(params: {
  guestName: string
  time: string
  floor: string
  ref: string
}): Promise<void> {
  const { data: staff } = await supabase
    .from('staff')
    .select('phone')
    .in('role', ['manager', 'host'])

  if (!staff?.length) return

  const message = [
    `⚠️ *Booking Cancelled*`,
    ``,
    `👤 ${params.guestName} · ${fmtTimeIST(params.time)} · ${floorLabel[params.floor] ?? params.floor}`,
    `🔖 ${params.ref}`,
    ``,
    `The slot is now free.`,
  ].join('\n')

  for (const member of staff) {
    sendWhatsAppMessage(member.phone, message).catch(() => {})
  }
}

// ── Cron Registration ──────────────────────────────────────────────────────────

export function startReminderJob(): void {
  // Every 10 min — 2h booking reminders
  cron.schedule('*/10 * * * *', () => {
    sendBookingReminders().catch(err => console.error('[reminder] Booking reminders failed:', err))
  })

  // Every 30 min — post-meal feedback
  cron.schedule('*/30 * * * *', () => {
    sendPostMealFeedback().catch(err => console.error('[reminder] Post-meal feedback failed:', err))
  })

  // Daily at 5 PM IST (11:30 UTC) — evening staff briefing
  cron.schedule('30 11 * * *', () => {
    sendEveningBriefing().catch(err => console.error('[reminder] Evening briefing failed:', err))
  })

  console.log('[reminder] Cron jobs started: booking reminders, post-meal feedback, evening briefing')
}
