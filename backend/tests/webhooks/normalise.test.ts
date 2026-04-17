import { describe, it, expect } from 'vitest'
import { normaliseWhatsApp, normaliseInstagram, IncomingMessage } from '../../src/webhooks/normalise'

describe('normaliseWhatsApp', () => {
  it('extracts sender, text, and channel from WhatsApp webhook payload', () => {
    const payload = {
      entry: [{
        changes: [{
          value: {
            messages: [{ from: '919876543210', text: { body: 'Is the Anjal in today?' }, type: 'text' }],
            contacts: [{ profile: { name: 'Priya' } }],
          },
        }],
      }],
    }

    const result = normaliseWhatsApp(payload)
    expect(result).toEqual<IncomingMessage>({
      channel: 'whatsapp',
      senderId: '919876543210',
      text: 'Is the Anjal in today?',
    })
  })

  it('returns null for non-text messages (images, audio)', () => {
    const payload = {
      entry: [{
        changes: [{
          value: {
            messages: [{ from: '919876543210', type: 'image' }],
          },
        }],
      }],
    }
    expect(normaliseWhatsApp(payload)).toBeNull()
  })

  it('returns null for status update webhooks (no messages key)', () => {
    const payload = { entry: [{ changes: [{ value: { statuses: [{}] } }] }] }
    expect(normaliseWhatsApp(payload)).toBeNull()
  })
})

describe('normaliseInstagram', () => {
  it('extracts sender, text, and channel from Instagram DM webhook payload', () => {
    const payload = {
      entry: [{
        messaging: [{
          sender: { id: 'ig_user_123' },
          message: { text: 'Do you have mud crab tonight?' },
        }],
      }],
    }

    const result = normaliseInstagram(payload)
    expect(result).toEqual<IncomingMessage>({
      channel: 'instagram',
      senderId: 'ig_user_123',
      text: 'Do you have mud crab tonight?',
    })
  })

  it('returns null when entry has no messaging array', () => {
    const payload = { entry: [{}] }
    expect(normaliseInstagram(payload)).toBeNull()
  })

  it('returns null for Instagram message with no text (e.g. sticker or voice note)', () => {
    const payload = {
      entry: [{
        messaging: [{
          sender: { id: 'ig_user_456' },
          message: { sticker_id: 'sticker_123' },
        }],
      }],
    }
    expect(normaliseInstagram(payload)).toBeNull()
  })
})
