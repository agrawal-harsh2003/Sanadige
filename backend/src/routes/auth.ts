import { Router } from 'express'
import { supabase } from '../lib/supabase'
import { sendWhatsAppMessage } from '../lib/whatsapp'

export const authRouter = Router()

authRouter.post('/send-otp', async (req, res) => {
  const { phone } = req.body as { phone?: string }
  if (!phone) return res.json({ ok: true })

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
      `Your Sanadige dashboard OTP is: *${code}*. Valid for 10 minutes.`
    )
  }

  res.json({ ok: true })
})
