import { Router } from 'express'
import axios from 'axios'
import { env } from '../env'
import { normaliseInstagram } from './normalise'
import { handleMessage } from '../services/claude'

export const instagramRouter = Router()

instagramRouter.get('/', (req, res) => {
  const mode = req.query['hub.mode']
  const token = req.query['hub.verify_token']
  const challenge = req.query['hub.challenge']

  if (mode === 'subscribe' && token === env.INSTAGRAM_VERIFY_TOKEN) {
    res.status(200).send(challenge)
  } else {
    res.sendStatus(403)
  }
})

instagramRouter.post('/', async (req, res) => {
  res.sendStatus(200)

  const message = normaliseInstagram(req.body)
  if (!message) return

  try {
    const reply = await handleMessage(message)

    await axios.post(
      'https://graph.facebook.com/v19.0/me/messages',
      { recipient: { id: message.senderId }, message: { text: reply } },
      { headers: { Authorization: `Bearer ${env.INSTAGRAM_PAGE_ACCESS_TOKEN}` } }
    )
  } catch (err) {
    console.error('Instagram handler error:', err)
    // Non-blocking — guest won't see an error but staff can monitor logs
  }
})
