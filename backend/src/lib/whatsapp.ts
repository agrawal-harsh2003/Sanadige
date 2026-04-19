import axios from 'axios'
import { env } from '../env'

const base = () => `https://graph.facebook.com/v19.0/${env.WHATSAPP_PHONE_NUMBER_ID}`
const headers = () => ({
  Authorization: `Bearer ${env.WHATSAPP_TOKEN}`,
  'Content-Type': 'application/json',
})

async function post(payload: unknown): Promise<void> {
  const res = await axios.post(`${base()}/messages`, payload, { headers: headers() })
  if (res.data?.error) {
    throw new Error(`WhatsApp API error: ${res.data.error.message} (code ${res.data.error.code})`)
  }
}

export async function sendWhatsAppMessage(to: string, text: string): Promise<void> {
  await post({ messaging_product: 'whatsapp', to, type: 'text', text: { body: text } })
}

export async function sendBookingConfirmationTemplate(
  to: string,
  params: { name: string; date: string; time: string; party: string; floor: string; ref: string }
): Promise<void> {
  await post({
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: 'booking_confirmation',
      language: { code: 'en' },
      components: [{
        type: 'body',
        parameters: [
          { type: 'text', text: params.name },
          { type: 'text', text: params.date },
          { type: 'text', text: params.time },
          { type: 'text', text: params.party },
          { type: 'text', text: params.floor },
          { type: 'text', text: params.ref },
        ],
      }],
    },
  })
}

export interface WaButton { id: string; title: string }

export async function sendButtons(to: string, body: string, buttons: WaButton[]): Promise<void> {
  await post({
    messaging_product: 'whatsapp',
    to,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: body },
      action: {
        buttons: buttons.map(b => ({ type: 'reply', reply: { id: b.id, title: b.title } })),
      },
    },
  })
}

export interface WaListRow { id: string; title: string; description?: string }
export interface WaListSection { title: string; rows: WaListRow[] }

export async function sendList(
  to: string,
  body: string,
  buttonLabel: string,
  sections: WaListSection[]
): Promise<void> {
  await post({
    messaging_product: 'whatsapp',
    to,
    type: 'interactive',
    interactive: {
      type: 'list',
      body: { text: body },
      action: { button: buttonLabel, sections },
    },
  })
}
