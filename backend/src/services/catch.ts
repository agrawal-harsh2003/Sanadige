import { supabase } from '../lib/supabase'

interface ParsedLine {
  name: string
  status: 'available' | 'sold_out' | 'tomorrow'
  notes: string | null
}

function parseLine(line: string): ParsedLine | null {
  const trimmed = line.trim()
  let status: 'available' | 'sold_out' | 'tomorrow'

  if (trimmed.startsWith('✅')) {
    status = 'available'
  } else if (trimmed.startsWith('❌')) {
    status = 'sold_out'
  } else if (trimmed.toLowerCase().includes('tomorrow')) {
    status = 'tomorrow'
  } else {
    return null
  }

  const cleaned = trimmed.replace(/^[✅❌]\s*/, '')
  const [namePart, ...noteParts] = cleaned.split('–')
  return {
    name: namePart.trim(),
    notes: noteParts.length > 0 ? noteParts.join('–').trim() : null,
    status,
  }
}

export async function parseCatchCommand(text: string, updatedBy: string): Promise<string> {
  const lines = text.split('\n').slice(1)
  const parsed = lines.map(parseLine).filter(Boolean) as ParsedLine[]

  if (parsed.length === 0) {
    return 'No items found. Format: ✅ Anjal – Goan or ❌ Lobster – not today'
  }

  // Use IST date so midnight-to-5:30am UTC doesn't update the wrong day
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
  const upsertRows: Record<string, unknown>[] = []
  const errors: string[] = []

  for (const item of parsed) {
    // Escape SQL LIKE metacharacters in user-supplied fish name
    const safeName = item.name.replace(/%/g, '\\%').replace(/_/g, '\\_')
    const { data, error } = await supabase
      .from('catch_items')
      .select('id')
      .ilike('name', `%${safeName}%`)
      .single()

    if (error || !data) {
      const msg = error?.code === 'PGRST116'
        ? `"${item.name}" not found in the catalogue`
        : error?.message?.includes('multiple')
          ? `"${item.name}" matches multiple catalogue entries — be more specific`
          : `"${item.name}" not found in the catalogue`
      errors.push(msg)
      continue
    }

    upsertRows.push({
      catch_item_id: data.id,
      date: today,
      status: item.status,
      notes: item.notes,
      updated_by: updatedBy,
      updated_at: new Date().toISOString(),
    })
  }

  if (upsertRows.length > 0) {
    const { error } = await supabase
      .from('daily_availability')
      .upsert(upsertRows, { onConflict: 'catch_item_id,date' })
    if (error) throw new Error(error.message)
  }

  const errMsg = errors.length > 0 ? `\nWarning: ${errors.join(', ')}` : ''
  return `✓ Catch updated — ${upsertRows.length} items set for today.${errMsg}`
}
