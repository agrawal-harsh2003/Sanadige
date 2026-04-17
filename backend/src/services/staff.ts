import { supabase } from '../lib/supabase'
import { env } from '../env'

export type StaffRole = 'chef' | 'host' | 'manager'

export interface StaffMember {
  phone: string
  name: string
  role: StaffRole
}

export async function getStaff(phone: string): Promise<StaffMember | null> {
  const { data } = await supabase
    .from('staff')
    .select('phone, name, role')
    .eq('phone', phone)
    .single()
  return data ?? null
}

// Called on startup — ensures MANAGER_PHONE from env is always in the staff table
export async function seedManagerFromEnv(): Promise<void> {
  if (!env.MANAGER_PHONE) return

  const { error } = await supabase
    .from('staff')
    .upsert(
      { phone: env.MANAGER_PHONE, name: 'Manager', role: 'manager', added_by: 'env' },
      { onConflict: 'phone', ignoreDuplicates: true }
    )

  if (error) console.error('[staff] Failed to seed manager from env:', error.message)
  else console.log(`[staff] Manager seeded from env: ${env.MANAGER_PHONE}`)
}

// Manager WhatsApp commands:
//   /staff add 919876543210 chef Rajesh
//   /staff remove 919876543210
//   /staff list
export async function handleStaffCommand(text: string, senderPhone: string): Promise<string> {
  const parts = text.trim().split(/\s+/)
  const sub = parts[1]?.toLowerCase()

  if (sub === 'list') {
    const { data, error } = await supabase
      .from('staff')
      .select('phone, name, role')
      .order('role')

    if (error) return 'Failed to fetch staff list.'
    if (!data || data.length === 0) return 'No staff members registered yet.'

    const lines = data.map((s: StaffMember) => `• ${s.name} (${s.role}) — ${s.phone}`)
    return `Staff (${data.length}):\n${lines.join('\n')}`
  }

  if (sub === 'add') {
    const phone = parts[2]
    const role = parts[3]?.toLowerCase() as StaffRole | undefined
    const name = parts.slice(4).join(' ')

    if (!phone || !role || !name) {
      return 'Usage: /staff add <phone> <chef|host|manager> <name>\nExample: /staff add 919876543210 chef Rajesh'
    }
    if (!['chef', 'host', 'manager'].includes(role)) {
      return 'Role must be one of: chef, host, manager'
    }

    const { error } = await supabase
      .from('staff')
      .upsert({ phone, name, role, added_by: senderPhone }, { onConflict: 'phone' })

    if (error) return `Failed to add staff: ${error.message}`
    return `✓ ${name} added as ${role} (${phone})`
  }

  if (sub === 'remove') {
    const phone = parts[2]
    if (!phone) return 'Usage: /staff remove <phone>'

    // Prevent removing the env-seeded manager
    if (phone === env.MANAGER_PHONE) {
      return 'Cannot remove the primary manager. Update MANAGER_PHONE in env to change this.'
    }

    const { error } = await supabase.from('staff').delete().eq('phone', phone)
    if (error) return `Failed to remove staff: ${error.message}`
    return `✓ Staff member ${phone} removed`
  }

  return 'Unknown command. Available: /staff list, /staff add, /staff remove'
}
