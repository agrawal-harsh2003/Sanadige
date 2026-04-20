'use client'
import { useState, useTransition } from 'react'
import { Fish } from 'lucide-react'
import { sendOtp, verifyOtp } from '@/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function LoginPage() {
  const [phone, setPhone] = useState('')
  const [step, setStep] = useState<'phone' | 'otp'>('phone')
  const [otp, setOtp] = useState('')
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleSendOtp(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    startTransition(async () => {
      await sendOtp(phone)
      setStep('otp')
    })
  }

  function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    startTransition(async () => {
      const result = await verifyOtp(phone, otp)
      if (result?.error) setError(result.error)
    })
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel — brand */}
      <div className="hidden md:flex flex-col justify-between w-1/2 bg-sidebar px-12 py-14">
        <div>
          <p className="text-sidebar-foreground font-bold text-3xl tracking-tight">Sanadige</p>
          <p className="text-sidebar-foreground/50 text-sm mt-1">Where the coast meets Delhi</p>
        </div>
        <div className="space-y-3">
          <p className="text-sidebar-foreground/80 text-lg font-medium leading-snug">
            Fresh from the coast.<br />Served with precision.
          </p>
          <p className="text-sidebar-foreground/40 text-sm">
            Staff operations portal — bookings, catch, floor, and more.
          </p>
        </div>
        <svg viewBox="0 0 400 60" className="opacity-10 -mx-12" fill="currentColor">
          <path d="M0,30 C50,10 100,50 150,30 C200,10 250,50 300,30 C350,10 400,50 450,30 L450,60 L0,60 Z" />
        </svg>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center bg-background px-6">
        <div className="w-full max-w-sm">
          <div className="bg-card rounded-2xl shadow-lg ring-1 ring-black/5 p-8">
            <div className="mb-8 text-center">
              <div className="w-14 h-14 rounded-2xl bg-accent flex items-center justify-center mx-auto mb-4">
                <Fish size={28} className="text-accent-foreground" />
              </div>
              <h1 className="text-2xl font-bold text-foreground">Staff Sign In</h1>
              <p className="text-sm text-muted-foreground mt-1">Enter your WhatsApp number to continue</p>
            </div>

            {step === 'phone' ? (
              <form onSubmit={handleSendOtp} className="space-y-5">
                <div>
                  <Label htmlFor="phone" className="text-foreground font-medium">WhatsApp number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+91 98765 43210"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    required
                    className="mt-1.5"
                  />
                </div>
                <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold h-11" disabled={isPending}>
                  {isPending ? 'Sending…' : 'Send OTP via WhatsApp'}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-5">
                <p className="text-sm text-muted-foreground text-center">OTP sent to <span className="font-medium text-foreground">{phone}</span></p>
                <div>
                  <Label htmlFor="otp" className="text-foreground font-medium">6-digit OTP</Label>
                  <Input
                    id="otp"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="• • • • • •"
                    value={otp}
                    onChange={e => setOtp(e.target.value)}
                    required
                    className="mt-1.5 tracking-[0.5em] text-center text-lg font-bold"
                  />
                </div>
                {error && <p className="text-sm text-destructive text-center">{error}</p>}
                <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold h-11" disabled={isPending}>
                  {isPending ? 'Verifying…' : 'Verify & Sign In'}
                </Button>
                <button
                  type="button"
                  className="text-sm text-muted-foreground hover:text-primary underline w-full text-center transition-colors"
                  onClick={() => setStep('phone')}
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
