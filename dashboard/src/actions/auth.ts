'use server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'

export { getSession }

export async function logout() {
  const cookieStore = await cookies()
  cookieStore.delete('__session')
  redirect('/login')
}
