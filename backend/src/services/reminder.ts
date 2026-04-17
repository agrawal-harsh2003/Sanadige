import cron from 'node-cron'
import { supabase } from '../lib/supabase'
import { sendWhatsAppMessage } from '../lib/whatsapp'
import { getTodayCatch } from '../tools/get-today-catch'

async function sendReminders(): Promise<void> {
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
    console.error('Reminder job error:', error.message)
    return
  }

  if (!bookings || bookings.length === 0) return

  let catchSummary = ''
  try {
    const catchText = await getTodayCatch()
    const lines = catchText.split('\n').slice(1)
    const available = lines
      .filter(l => l.includes('available'))
      .map(l => l.split('(')[0].replace('-', '').trim())
    if (available.length > 0) {
      catchSummary = `\n\nTonight's fresh catch: ${available.join(', ')} 🐟`
    }
  } catch {
    // Non-critical — reminder goes out without catch info
  }

  const floorLabel: Record<string, string> = {
    terrace: 'terrace',
    floor1: 'ground floor',
    floor2: 'second floor',
    private: 'private dining room',
  }

  for (const booking of bookings) {
    const localTime = new Date(booking.datetime).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      timeStyle: 'short',
    })

    const message = [
      `Hi ${booking.guest_name}! 🐟 Your Sanadige table is set for *tonight at ${localTime}*`,
      `${booking.party_size} guests · ${floorLabel[booking.floor] ?? booking.floor} · Ref: ${booking.booking_ref}`,
      catchSummary,
      '\nReply "cancel" to cancel your booking. See you soon!',
    ].join('\n')

    try {
      await sendWhatsAppMessage(booking.whatsapp_id, message)
      await supabase
        .from('bookings')
        .update({ reminder_sent_at: new Date().toISOString() })
        .eq('id', booking.id)
    } catch (err) {
      console.error(`Failed to send reminder for ${booking.booking_ref}:`, err)
    }
  }
}

export function startReminderJob(): void {
  cron.schedule('*/10 * * * *', () => {
    sendReminders().catch(err => console.error('Reminder job failed:', err))
  })
  console.log('Reminder cron job started')
}
