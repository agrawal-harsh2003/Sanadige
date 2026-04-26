'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Fish } from 'lucide-react'
import { getClientAuth } from '@/lib/firebase-client'
import {
  signInWithPhoneNumber,
  RecaptchaVerifier,
  type ConfirmationResult,
} from 'firebase/auth'

export default function LoginPage() {
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [step, setStep] = useState<'phone' | 'otp'>('phone')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const confirmationRef = useRef<ConfirmationResult | null>(null)
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null)
  const router = useRouter()

  async function sendOtp(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const auth = getClientAuth()
      if (!recaptchaRef.current) {
        recaptchaRef.current = new RecaptchaVerifier(auth, 'recaptcha-container', { size: 'invisible' })
      }
      const digits = phone.replace(/\D/g, '')
      const e164 = digits.length === 10 ? `+91${digits}` : `+${digits}`
      const result = await signInWithPhoneNumber(auth, e164, recaptchaRef.current)
      confirmationRef.current = result
      setStep('otp')
    } catch (err: unknown) {
      setError((err as Error).message ?? 'Failed to send OTP')
    } finally {
      setLoading(false)
    }
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault()
    if (!confirmationRef.current) return
    setError('')
    setLoading(true)
    try {
      const result = await confirmationRef.current.confirm(otp)
      const idToken = await result.user.getIdToken()
      const res = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      })
      if (!res.ok) throw new Error('Session creation failed — you may not be registered as staff')
      router.push('/dashboard')
    } catch (err: unknown) {
      setError((err as Error).message ?? 'Invalid OTP')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="hidden md:flex flex-col justify-between w-1/2 bg-sidebar px-12 py-14">
        <div>
          <p className="text-sidebar-foreground font-bold text-3xl tracking-tight">Sanadige</p>
          <p className="text-sidebar-foreground/50 text-sm mt-1">Where the coast meets Delhi</p>
        </div>
        <div className="space-y-3">
          <p className="text-sidebar-foreground/80 text-lg font-medium leading-snug">
            Fresh from the coast.<br />Served with precision.
          </p>
          <p className="text-sidebar-foreground/40 text-sm">Staff operations portal</p>
        </div>
        <svg viewBox="0 0 400 60" className="opacity-10 -mx-12" fill="currentColor">
          <path d="M0,30 C50,10 100,50 150,30 C200,10 250,50 300,30 C350,10 400,50 450,30 L450,60 L0,60 Z" />
        </svg>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center bg-background px-6">
        <div className="w-full max-w-sm">
          <div className="bg-card rounded-2xl shadow-lg ring-1 ring-black/5 p-8">
            <div className="mb-8 text-center">
              <div className="w-14 h-14 rounded-2xl bg-accent flex items-center justify-center mx-auto mb-4">
                <Fish size={28} className="text-accent-foreground" />
              </div>
              <h1 className="text-2xl font-bold text-foreground">Staff Sign In</h1>
              <p className="text-sm text-muted-foreground mt-1">Enter your phone number to receive an OTP</p>
            </div>

            <div id="recaptcha-container" />

            {step === 'phone' ? (
              <form onSubmit={sendOtp} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Phone number</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    required
                    className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <button
                  type="submit"
                  disabled={loading || !phone}
                  className="w-full h-11 bg-primary text-primary-foreground rounded-lg text-sm font-semibold disabled:opacity-50"
                >
                  {loading ? 'Sending…' : 'Send OTP'}
                </button>
              </form>
            ) : (
              <form onSubmit={verifyOtp} className="space-y-5">
                <p className="text-sm text-muted-foreground text-center">
                  OTP sent to <span className="font-medium text-foreground">{phone}</span>
                </p>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">6-digit OTP</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={otp}
                    onChange={e => setOtp(e.target.value)}
                    placeholder="• • • • • •"
                    maxLength={6}
                    required
                    className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm text-center tracking-[0.5em] font-bold focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <button
                  type="submit"
                  disabled={loading || otp.length < 6}
                  className="w-full h-11 bg-primary text-primary-foreground rounded-lg text-sm font-semibold disabled:opacity-50"
                >
                  {loading ? 'Verifying…' : 'Verify & Sign In'}
                </button>
                <button
                  type="button"
                  onClick={() => setStep('phone')}
                  className="w-full text-sm text-muted-foreground hover:text-primary underline text-center"
                >
                  Use a different number
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
