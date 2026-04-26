'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
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
      {/* Left panel — deep teal */}
      <div className="hidden md:flex flex-col justify-between w-[45%] bg-sidebar px-14 py-14 relative overflow-hidden">
        {/* Subtle wave pattern */}
        <svg
          viewBox="0 0 600 600"
          className="absolute inset-0 w-full h-full opacity-[0.04] pointer-events-none"
          preserveAspectRatio="xMidYMid slice"
        >
          <defs>
            <pattern id="wave" x="0" y="0" width="120" height="60" patternUnits="userSpaceOnUse">
              <path d="M0,30 C20,10 40,50 60,30 C80,10 100,50 120,30" fill="none" stroke="white" strokeWidth="1.5" />
            </pattern>
          </defs>
          <rect width="600" height="600" fill="url(#wave)" />
        </svg>

        <div className="relative">
          <p className="font-cormorant text-sidebar-foreground text-[42px] font-semibold leading-none tracking-wide">
            Sanadige
          </p>
          <p className="text-sidebar-foreground/40 text-[11px] mt-2 uppercase tracking-[0.2em] font-medium">
            New Delhi
          </p>
        </div>

        <div className="relative space-y-4">
          <p className="font-cormorant text-sidebar-foreground/80 text-[26px] font-light leading-snug">
            Fresh from the coast.<br />
            <span className="italic">Served with precision.</span>
          </p>
          <p className="text-sidebar-foreground/35 text-[12px] tracking-wide uppercase font-medium">
            Staff Operations Portal
          </p>
        </div>

        {/* Bottom decorative line */}
        <div className="relative">
          <div className="h-px bg-gradient-to-r from-transparent via-sidebar-foreground/20 to-transparent" />
          <p className="text-sidebar-foreground/20 text-[10px] mt-4 uppercase tracking-[0.25em] font-medium text-center">
            Est. New Delhi
          </p>
        </div>
      </div>

      {/* Right panel — warm sand */}
      <div className="flex-1 flex items-center justify-center bg-background px-6">
        <div className="w-full max-w-[340px]">

          {/* Mobile brand */}
          <div className="md:hidden text-center mb-8">
            <p className="font-cormorant text-foreground text-4xl font-semibold">Sanadige</p>
            <p className="text-muted-foreground text-xs tracking-[0.15em] uppercase mt-1">New Delhi</p>
          </div>

          <div className="bg-card rounded-2xl shadow-sm ring-1 ring-black/[0.04] p-8">
            <div className="mb-7">
              <h2 className="font-cormorant text-foreground text-[26px] font-semibold leading-none">Staff Sign In</h2>
              <p className="text-[12px] text-muted-foreground mt-2">
                {step === 'phone' ? 'Enter your registered phone number' : `OTP sent to ${phone}`}
              </p>
            </div>

            <div id="recaptcha-container" />

            {step === 'phone' ? (
              <form onSubmit={sendOtp} className="space-y-5">
                <div>
                  <label className="block text-[12px] font-medium text-foreground/70 mb-2 uppercase tracking-[0.08em]">
                    Phone number
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    required
                    className="w-full h-11 px-4 rounded-xl border border-border bg-background text-[13px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary/40 transition-all"
                  />
                </div>
                {error && <p className="text-[12px] text-destructive">{error}</p>}
                <button
                  type="submit"
                  disabled={loading || !phone}
                  className="w-full h-11 bg-primary text-primary-foreground rounded-xl text-[13px] font-semibold disabled:opacity-40 hover:bg-primary/90 transition-colors"
                >
                  {loading ? 'Sending…' : 'Send OTP'}
                </button>
              </form>
            ) : (
              <form onSubmit={verifyOtp} className="space-y-5">
                <div>
                  <label className="block text-[12px] font-medium text-foreground/70 mb-2 uppercase tracking-[0.08em]">
                    6-digit OTP
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={otp}
                    onChange={e => setOtp(e.target.value)}
                    placeholder="· · · · · ·"
                    maxLength={6}
                    required
                    className="w-full h-11 px-4 rounded-xl border border-border bg-background text-[18px] text-center tracking-[0.6em] font-cormorant font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary/40 transition-all"
                  />
                </div>
                {error && <p className="text-[12px] text-destructive">{error}</p>}
                <button
                  type="submit"
                  disabled={loading || otp.length < 6}
                  className="w-full h-11 bg-primary text-primary-foreground rounded-xl text-[13px] font-semibold disabled:opacity-40 hover:bg-primary/90 transition-colors"
                >
                  {loading ? 'Verifying…' : 'Verify & Sign In'}
                </button>
                <button
                  type="button"
                  onClick={() => setStep('phone')}
                  className="w-full text-[12px] text-muted-foreground hover:text-foreground transition-colors text-center"
                >
                  ← Use a different number
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
