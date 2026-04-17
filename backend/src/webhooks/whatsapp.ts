import { Router } from 'express'
import { env } from '../env'
import { normaliseWhatsApp } from './normalise'
import { handleMessage } from '../services/claude'
import { parseCatchCommand } from '../services/catch'
import { sendWhatsAppMessage } from '../lib/whatsapp'

export const whatsappRouter = Router()

whatsappRouter.get('/', (req, res) => {
  const mode = req.query['hub.mode']
  const token = req.query['hub.verify_token']
  const challenge = req.query['hub.challenge']

  if (mode === 'subscribe' && token === env.WHATSAPP_VERIFY_TOKEN) {
    res.status(200).send(challenge)
  } else {
    res.sendStatus(403)
  }
})

whatsappRouter.post('/', async (req, res) => {
  res.sendStatus(200)

  const message = normaliseWhatsApp(req.body)
  if (!message) return

  try {
    if (message.text.trim().startsWith('/catch')) {
      const reply = await parseCatchCommand(message.text, message.senderId)
      await sendWhatsAppMessage(message.senderId, reply)
      return
    }

    const reply = await handleMessage(message)
    await sendWhatsAppMessage(message.senderId, reply)
  } catch (err) {
    console.error('WhatsApp handler error:', err)
    await sendWhatsAppMessage(
      message.senderId,
      'Sorry, our team will respond shortly. You can also call us at +91 91678 85275.'
    ).catch(() => {})
  }
})
