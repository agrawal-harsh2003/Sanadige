import axios from 'axios'
import { env } from '../env'

export async function sendWhatsAppMessage(to: string, text: string): Promise<void> {
  const base = `https://graph.facebook.com/v19.0/${env.WHATSAPP_PHONE_NUMBER_ID}`
  const response = await axios.post(
    `${base}/messages`,
    {
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: text },
    },
    {
      headers: {
        Authorization: `Bearer ${env.WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json',
      },
    }
  )
  if (response.data?.error) {
    throw new Error(
      `WhatsApp API error: ${response.data.error.message} (code ${response.data.error.code})`
    )
  }
}
