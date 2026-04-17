import { Router } from 'express'
import { env } from '../env'
import { normaliseWhatsApp } from './normalise'
import { handleMessage } from '../services/claude'
import { parseCatchCommand } from '../services/catch'
import { getStaff, handleStaffCommand } from '../services/staff'
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

  const text = message.text.trim()

  try {
    const staff = await getStaff(message.senderId)

    // Manager commands — only managers can run /staff
    if (staff?.role === 'manager' && text.startsWith('/staff')) {
      const reply = await handleStaffCommand(text, message.senderId)
      await sendWhatsAppMessage(message.senderId, reply)
      return
    }

    // Chef commands — chefs and managers can update the catch
    if ((staff?.role === 'chef' || staff?.role === 'manager') && text.startsWith('/catch')) {
      const reply = await parseCatchCommand(text, message.senderId)
      await sendWhatsAppMessage(message.senderId, reply)
      return
    }

    // Unknown staff commands — tell staff they sent something unrecognised
    if (staff && text.startsWith('/')) {
      const roleCommands: Record<string, string> = {
        chef: '/catch today  ✅ Fish – note  ❌ Fish – note',
        host: '(no WhatsApp commands yet — use the dashboard)',
        manager: '/catch today ...\n/staff add <phone> <role> <name>\n/staff remove <phone>\n/staff list',
      }
      await sendWhatsAppMessage(
        message.senderId,
        `Unknown command. Available for ${staff.role}:\n${roleCommands[staff.role]}`
      )
      return
    }

    // Everyone else (customers, hosts chatting, unrecognised senders) → Claude
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
