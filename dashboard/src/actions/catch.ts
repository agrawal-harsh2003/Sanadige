'use server'
import { revalidatePath } from 'next/cache'
import { getSupabase } from '@/lib/supabase'

export async function toggleCatch(
  catchItemId: string,
  status: 'available' | 'sold_out' | 'tomorrow'
) {
  const supabase = getSupabase()
  const today = new Date().toISOString().split('T')[0]
  await supabase.from('daily_availability').upsert(
    { catch_item_id: catchItemId, date: today, status },
    { onConflict: 'catch_item_id,date' }
  )
  revalidatePath('/dashboard/catch')
  revalidatePath('/dashboard')
}

export async function updateNote(catchItemId: string, notes: string) {
  const supabase = getSupabase()
  const today = new Date().toISOString().split('T')[0]
  await supabase
    .from('daily_availability')
    .update({ notes })
    .eq('catch_item_id', catchItemId)
    .eq('date', today)
  revalidatePath('/dashboard/catch')
}

export async function addCatch(data: {
  name: string
  origin_region: string
  recommended_preps: string[]
  spice_level: number
}) {
  const supabase = getSupabase()
  const today = new Date().toISOString().split('T')[0]

  const { data: item } = await supabase
    .from('catch_items')
    .insert({
      name: data.name,
      origin_region: data.origin_region,
      recommended_preps: data.recommended_preps,
      spice_level: data.spice_level,
      description: '',
    })
    .select('id')
    .single()

  if (item) {
    await supabase
      .from('daily_availability')
      .insert({ catch_item_id: item.id, date: today, status: 'available' })
  }

  revalidatePath('/dashboard/catch')
  revalidatePath('/dashboard')
}
