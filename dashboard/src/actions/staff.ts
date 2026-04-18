'use server'
import { revalidatePath } from 'next/cache'
import { getSupabase } from '@/lib/supabase'
import { cloudRunPost } from '@/lib/cloud-run'

export async function addStaff(data: { name: string; phone: string; role: string }) {
  const supabase = getSupabase()
  await supabase.from('staff').upsert(data, { onConflict: 'phone' })

  await cloudRunPost('/staff/welcome', {
    phone: data.phone,
    name: data.name,
    role: data.role,
  }).catch(() => {})

  revalidatePath('/dashboard/staff')
  revalidatePath('/dashboard')
}

export async function updateStaffRole(id: string, role: string) {
  const supabase = getSupabase()
  await supabase.from('staff').update({ role }).eq('id', id)
  revalidatePath('/dashboard/staff')
}

export async function removeStaff(id: string) {
  const supabase = getSupabase()
  await supabase.from('staff').delete().eq('id', id)
  revalidatePath('/dashboard/staff')
  revalidatePath('/dashboard')
}
