import cron from 'node-cron'
import { db } from '../lib/firebase'
import { sendWhatsAppMessage, sendReminderTemplate, sendDayOfTemplate, sendPostMealFeedbackTemplate } from '../lib/whatsapp'

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

async function getStaffPhones(roles: string[]): Promise<string[]> {
  const snap = await db.collection('staff').where('role', 'in', roles).get()
  return snap.docs.map(d => d.data().phone as string).filter(Boolean)
}

// ── 2-Hour Booking Reminder ────────────────────────────────────────────────────

async function sendBookingReminders(): Promise<void> {
  const now = new Date()
  const windowStart = new Date(now.getTime() + 110 * 60 * 1000).toISOString()
  const windowEnd   = new Date(now.getTime() + 120 * 60 * 1000).toISOString()

  const snap = await db.collection('bookings')
    .where('status', '==', 'confirmed')
    .where('reminder_sent_at', '==', null)
    .where('datetime', '>=', windowStart)
    .where('datetime', '<', windowEnd)
    .get()

  for (const doc of snap.docs) {
    const b = doc.data()
    try {
      await sendReminderTemplate(b.whatsapp_id, {
        name:  b.guest_name,
        time:  fmtTimeIST(b.datetime),
        party: String(b.party_size),
        floor: floorLabel[b.floor] ?? b.floor,
        ref:   b.booking_ref,
      })
      await doc.ref.update({ reminder_sent_at: new Date().toISOString() })
      console.log(`[reminder] Reminder sent for ${b.booking_ref}`)
    } catch (err) {
      console.error(`[reminder] Failed reminder for ${b.booking_ref}:`, err)
    }
  }
}

// ── Post-Meal Feedback ─────────────────────────────────────────────────────────

async function sendPostMealFeedback(): Promise<void> {
  const now = new Date()
  const windowStart = new Date(now.getTime() - 150 * 60 * 1000).toISOString()
  const windowEnd   = new Date(now.getTime() - 90 * 60 * 1000).toISOString()

  const snap = await db.collection('bookings')
    .where('status', 'in', ['confirmed', 'seated'])
    .where('feedback_sent_at', '==', null)
    .where('datetime', '>=', windowStart)
    .where('datetime', '<', windowEnd)
    .get()

  for (const doc of snap.docs) {
    const b = doc.data()
    try {
      await sendPostMealFeedbackTemplate(b.whatsapp_id, { name: b.guest_name })
      await doc.ref.update({ feedback_sent_at: new Date().toISOString() })
      console.log(`[reminder] Feedback sent for ${b.booking_ref}`)
    } catch (err) {
      console.error(`[reminder] Failed feedback for ${b.booking_ref}:`, err)
    }
  }
}

// ── Evening Staff Briefing (5 PM IST = 11:30 UTC) ────────────────────────────

async function sendEveningBriefing(): Promise<void> {
  const today = new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().split('T')[0]

  const snap = await db.collection('bookings')
    .where('status', '==', 'confirmed')
    .where('datetime', '>=', `${today}T00:00:00+05:30`)
    .where('datetime', '<=', `${today}T23:59:59+05:30`)
    .get()

  const bookings = snap.docs.map(d => d.data())
  const totalCovers = bookings.reduce((s, b) => s + (b.party_size ?? 0), 0)

  const hourCounts: Record<number, number> = {}
  bookings.forEach(b => {
    const h = new Date(b.datetime).getUTCHours() + 5
    hourCounts[h] = (hourCounts[h] ?? 0) + 1
  })
  const peakHour = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0]
  const peakStr = peakHour ? ` · Peak: ${peakHour[0]}:00 (${peakHour[1]} bookings)` : ''

  const floorBreakdown = ['terrace', 'floor1', 'floor2', 'private']
    .map(f => {
      const count = bookings.filter(b => b.floor === f).length
      return count > 0 ? `${floorLabel[f]}: ${count}` : null
    })
    .filter((l): l is string => l !== null)
    .join(' · ')

  const message = [
    `📊 *Evening Briefing — Tonight*`,
    ``,
    `📅 ${bookings.length} confirmed bookings · ${totalCovers} covers${peakStr}`,
    floorBreakdown ? `📍 ${floorBreakdown}` : null,
    ``,
    `Dashboard: dashboard.sanadige.in`,
  ].filter((l): l is string => l !== null).join('\n')

  const phones = await getStaffPhones(['manager', 'host'])
  for (const phone of phones) {
    try {
      await sendWhatsAppMessage(phone, message)
    } catch (err) {
      console.error(`[reminder] Briefing failed for ${phone}:`, err)
    }
  }
  console.log(`[reminder] Evening briefing sent to ${phones.length} staff`)
}

// ── Auto No-Show (20-min grace) ───────────────────────────────────────────────

async function markNoShows(): Promise<void> {
  const cutoff = new Date(Date.now() - 20 * 60 * 1000).toISOString()

  const snap = await db.collection('bookings')
    .where('status', '==', 'confirmed')
    .where('checked_in_at', '==', null)
    .where('datetime', '<', cutoff)
    .get()

  const managerPhones = await getStaffPhones(['manager', 'host'])

  for (const doc of snap.docs) {
    const b = doc.data()
    await doc.ref.update({ status: 'no_show', no_show_at: new Date().toISOString() })
    console.log(`[reminder] No-show: ${b.booking_ref}`)

    const msg = `⚫ No-show: *${b.guest_name}* · ${fmtTimeIST(b.datetime)} · ${floorLabel[b.floor] ?? b.floor}\nRef: ${b.booking_ref}`
    for (const phone of managerPhones) {
      sendWhatsAppMessage(phone, msg).catch(() => {})
    }
  }
}

// ── 1-Hour Day-Of Message ─────────────────────────────────────────────────────

async function sendDayOfMessages(): Promise<void> {
  const now = new Date()
  const windowStart = new Date(now.getTime() + 50 * 60 * 1000).toISOString()
  const windowEnd   = new Date(now.getTime() + 70 * 60 * 1000).toISOString()

  const snap = await db.collection('bookings')
    .where('status', '==', 'confirmed')
    .where('dayof_sent_at', '==', null)
    .where('datetime', '>=', windowStart)
    .where('datetime', '<', windowEnd)
    .get()

  for (const doc of snap.docs) {
    const b = doc.data()
    try {
      await sendDayOfTemplate(b.whatsapp_id, {
        time:  fmtTimeIST(b.datetime),
        floor: floorLabel[b.floor] ?? b.floor,
      })
      await doc.ref.update({ dayof_sent_at: new Date().toISOString() })
      console.log(`[reminder] Day-of sent for ${b.booking_ref}`)
    } catch (err) {
      console.error(`[reminder] Day-of failed for ${b.booking_ref}:`, err)
    }
  }
}

// ── Staff Alert Exports ────────────────────────────────────────────────────────

export async function notifyStaffOfBooking(params: {
  guestName: string
  partySize: number | string
  date: string
  time: string
  floor: string
  ref: string
  createdBy?: string
}): Promise<void> {
  const phones = await getStaffPhones(['manager', 'host'])
  const message = [
    `📅 *New Booking Alert*`,
    ``,
    `👤 ${params.guestName} · ${params.partySize} guests`,
    `📅 ${params.date} · ${params.time}`,
    `📍 ${floorLabel[params.floor] ?? params.floor}`,
    `🔖 ${params.ref}`,
    params.createdBy ? `\nAdded by: ${params.createdBy}` : null,
  ].filter((l): l is string => l !== null).join('\n')

  for (const phone of phones) {
    sendWhatsAppMessage(phone, message).catch(() => {})
  }
}

export async function notifyStaffOfCancellation(params: {
  guestName: string
  time: string
  floor: string
  ref: string
}): Promise<void> {
  const phones = await getStaffPhones(['manager', 'host'])
  const message = [
    `⚠️ *Booking Cancelled*`,
    ``,
    `👤 ${params.guestName} · ${fmtTimeIST(params.time)} · ${floorLabel[params.floor] ?? params.floor}`,
    `🔖 ${params.ref}`,
    ``,
    `The slot is now free.`,
  ].join('\n')

  for (const phone of phones) {
    sendWhatsAppMessage(phone, message).catch(() => {})
  }
}

// ── Cron Registration ──────────────────────────────────────────────────────────

export function startReminderJob(): void {
  cron.schedule('*/10 * * * *', () => {
    sendBookingReminders().catch(err => console.error('[reminder] Reminders failed:', err))
  })
  cron.schedule('*/30 * * * *', () => {
    sendPostMealFeedback().catch(err => console.error('[reminder] Feedback failed:', err))
  })
  cron.schedule('30 11 * * *', () => {
    sendEveningBriefing().catch(err => console.error('[reminder] Briefing failed:', err))
  })
  cron.schedule('* * * * *', () => {
    markNoShows().catch(err => console.error('[reminder] No-show failed:', err))
  })
  cron.schedule('*/10 * * * *', () => {
    sendDayOfMessages().catch(err => console.error('[reminder] Day-of failed:', err))
  })
  console.log('[reminder] Cron jobs started')
}
