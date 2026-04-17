import { describe, it, expect, vi, beforeEach } from 'vitest'
import axios from 'axios'

vi.mock('axios')
vi.mock('../../src/env', () => ({
  env: {
    WHATSAPP_TOKEN: 'test-token',
    WHATSAPP_PHONE_NUMBER_ID: '123456',
  },
}))

const { sendWhatsAppMessage } = await import('../../src/lib/whatsapp')

describe('sendWhatsAppMessage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('posts to WhatsApp Cloud API with correct payload', async () => {
    vi.mocked(axios.post).mockResolvedValue({ data: { messages: [{ id: 'wamid.123' }] } })

    await sendWhatsAppMessage('919876543210', 'Hello Priya!')

    expect(axios.post).toHaveBeenCalledWith(
      'https://graph.facebook.com/v19.0/123456/messages',
      {
        messaging_product: 'whatsapp',
        to: '919876543210',
        type: 'text',
        text: { body: 'Hello Priya!' },
      },
      { headers: { Authorization: 'Bearer test-token', 'Content-Type': 'application/json' } }
    )
  })

  it('throws when API returns non-2xx', async () => {
    vi.mocked(axios.post).mockRejectedValue(new Error('Request failed with status code 400'))
    await expect(sendWhatsAppMessage('919876543210', 'Hi')).rejects.toThrow('400')
  })

  it('throws when API returns 200 with error body', async () => {
    vi.mocked(axios.post).mockResolvedValue({
      data: { error: { message: 'Invalid phone number', code: 100 } },
    })
    await expect(sendWhatsAppMessage('invalid', 'Hi')).rejects.toThrow('WhatsApp API error: Invalid phone number (code 100)')
  })
})
