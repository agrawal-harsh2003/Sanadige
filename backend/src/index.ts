import 'dotenv/config'
import express from 'express'
import { env } from './env'
import { whatsappRouter } from './webhooks/whatsapp'
import { bookingsRouter } from './routes/bookings'
import { startReminderJob } from './services/reminder'
import { seedManagerFromEnv } from './services/staff'

const app = express()
app.use(express.json())

app.get('/health', (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }))
app.use('/bookings', bookingsRouter)
app.use('/webhooks/whatsapp', whatsappRouter)

app.listen(env.PORT, async () => {
  console.log(`Sanadige backend running on :${env.PORT}`)
  await seedManagerFromEnv()
  startReminderJob()
})
