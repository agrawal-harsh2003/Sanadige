import { supabase } from '../lib/supabase'

export async function getTodayCatch(): Promise<string> {
  const today = new Date().toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('daily_availability')
    .select(`
      status, notes,
      catch_items (name, origin_region, description, recommended_preps, allergens)
    `)
    .eq('date', today)

  if (error) throw new Error(`Failed to fetch catch: ${error.message}`)
  if (!data || data.length === 0) return 'No catch availability data for today yet.'

  const lines = data.map((row: Record<string, unknown>) => {
    const item = row.catch_items as Record<string, unknown> | null
    if (!item) return null
    const prepsArr = Array.isArray(item.recommended_preps) ? item.recommended_preps as string[] : []
    const preps = prepsArr.length > 0 ? prepsArr.join(', ') : 'ask staff'
    const note = row.notes ? ` (${String(row.notes)})` : ''
    return `- ${item.name} (${item.origin_region}): ${row.status}${note}. Recommended: ${preps}. ${item.description}`
  }).filter((line): line is string => line !== null)

  return `Today's catch availability:\n${lines.join('\n')}`
}

export const getTodayCatchDefinition = {
  name: 'get_today_catch',
  description: 'Get today\'s fresh seafood availability, origin, and recommended preparations. Call this whenever a customer asks what fish is available, what the catch is today, or about a specific seafood item.',
  input_schema: {
    type: 'object' as const,
    properties: {},
    required: [],
  },
}
