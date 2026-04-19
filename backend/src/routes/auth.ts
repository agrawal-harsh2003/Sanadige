import { Router } from 'express'
import { supabase } from '../lib/supabase'
import { sendWhatsAppMessage } from '../lib/whatsapp'

export const authRouter = Router()

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  // Indian numbers entered as 10 digits → prepend 91
  if (digits.length === 10) return `91${digits}`
  return digits
}

authRouter.post('/send-otp', async (req, res) => {
  try {
    const { phone: rawPhone } = req.body as { phone?: string }
    if (!rawPhone) return res.json({ ok: true })

    const phone = normalizePhone(rawPhone)

    const { data: staff } = await supabase
      .from('staff')
      .select('phone')
      .eq('phone', phone)
      .single()

    if (staff) {
      const code = String(Math.floor(100000 + Math.random() * 900000))
      const expires_at = new Date(Date.now() + 10 * 60 * 1000).toISOString()

      await supabase.from('staff_otps').delete().eq('phone', phone).eq('used', false)
      await supabase.from('staff_otps').insert({ phone, code, expires_at })

      await sendWhatsAppMessage(
        phone,
        `Your Sanadige dashboard OTP is: *${code}*\n\nValid for 10 minutes. Do not share this with anyone.`
      )
      console.log(`[auth] OTP sent to ${phone}`)
    } else {
      console.log(`[auth] OTP request for unknown phone: ${phone}`)
    }
  } catch (err) {
    console.error('[auth] send-otp error:', err)
  }

  res.json({ ok: true })
})
