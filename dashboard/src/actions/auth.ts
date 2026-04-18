'use server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getSupabase } from '@/lib/supabase'
import { signJwt, verifyJwt, type Role, type JwtPayload } from '@/lib/auth'
import { cloudRunPost } from '@/lib/cloud-run'

export async function sendOtp(phone: string): Promise<{ ok: boolean }> {
  await cloudRunPost('/auth/send-otp', { phone })
  return { ok: true }
}

export async function verifyOtp(
  phone: string,
  code: string
): Promise<{ error?: string }> {
  const supabase = getSupabase()
  const now = new Date().toISOString()

  const { data: otp } = await supabase
    .from('staff_otps')
    .select('id, code, expires_at, used')
    .eq('phone', phone)
    .eq('used', false)
    .gt('expires_at', now)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!otp || otp.code !== code) {
    return { error: 'Invalid or expired OTP' }
  }

  await supabase.from('staff_otps').update({ used: true }).eq('id', otp.id)

  const { data: staff } = await supabase
    .from('staff')
    .select('phone, name, role')
    .eq('phone', phone)
    .single()

  if (!staff) return { error: 'Staff not found' }

  const payload: JwtPayload = {
    phone: staff.phone,
    name: staff.name,
    role: staff.role as Role,
  }

  const token = await signJwt(payload)

  const cookieStore = await cookies()
  cookieStore.set('snd_session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 60 * 60 * 12,
    path: '/',
  })

  redirect('/dashboard')
}

export async function getSession(): Promise<JwtPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('snd_session')?.value
  if (!token) return null
  return verifyJwt(token)
}

export async function logout() {
  const cookieStore = await cookies()
  cookieStore.delete('snd_session')
  redirect('/login')
}
