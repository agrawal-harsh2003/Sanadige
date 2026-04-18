import express from 'express'
import { env } from './env'
import { whatsappRouter } from './webhooks/whatsapp'
import { instagramRouter } from './webhooks/instagram'
import { authRouter } from './routes/auth'
import { startReminderJob } from './services/reminder'
import { seedManagerFromEnv } from './services/staff'

const app = express()
app.use(express.json())

app.get('/health', (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }))
app.use('/auth', authRouter)
app.use('/webhooks/whatsapp', whatsappRouter)
app.use('/webhooks/instagram', instagramRouter)

app.listen(env.PORT, async () => {
  console.log(`Sanadige backend running on :${env.PORT}`)
  await seedManagerFromEnv()
  startReminderJob()
})
