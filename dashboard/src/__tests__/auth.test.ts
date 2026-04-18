/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest'
import { signJwt, verifyJwt } from '../lib/auth'

describe('JWT auth', () => {
  it('signs and verifies a valid payload', async () => {
    process.env.JWT_SECRET = 'test-secret-that-is-at-least-32-bytes-long!!'
    const payload = { phone: '+919876543210', name: 'Harsh', role: 'manager' as const }
    const token = await signJwt(payload)
    const result = await verifyJwt(token)
    expect(result?.phone).toBe(payload.phone)
    expect(result?.role).toBe(payload.role)
  })

  it('returns null for tampered token', async () => {
    process.env.JWT_SECRET = 'test-secret-that-is-at-least-32-bytes-long!!'
    const result = await verifyJwt('not.a.valid.token')
    expect(result).toBeNull()
  })
})
