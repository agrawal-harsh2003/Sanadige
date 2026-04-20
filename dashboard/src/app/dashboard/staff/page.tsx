import { getSupabase } from '@/lib/supabase'
import { StaffCard } from '@/components/staff/StaffCard'
import { AddStaffDrawer } from '@/components/staff/AddStaffDrawer'

export default async function StaffPage() {
  const supabase = getSupabase()
  const { data: staff } = await supabase.from('staff').select('*').order('created_at')
  const members = staff ?? []

  const managerPhone = process.env.MANAGER_PHONE
  const managers = members.filter(s => s.role === 'manager').length
  const chefs = members.filter(s => s.role === 'chef').length
  const hosts = members.filter(s => s.role === 'host').length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">Staff</h1>
        <AddStaffDrawer />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Managers', value: managers },
          { label: 'Chefs', value: chefs },
          { label: 'Hosts', value: hosts },
          { label: 'Total', value: members.length },
        ].map(m => (
          <div key={m.label} className="bg-card shadow-sm ring-1 ring-black/5 rounded-2xl p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{m.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{m.label}</p>
          </div>
        ))}
      </div>
      <div className="space-y-3">
        {members.map(s => (
          <StaffCard
            key={s.id}
            id={s.id}
            name={s.name}
            phone={s.phone}
            role={s.role}
            created_at={s.created_at}
            isPrimary={managerPhone ? s.phone === managerPhone : false}
          />
        ))}
        {members.length === 0 && (
          <p className="text-muted-foreground text-center py-12">No staff members yet.</p>
        )}
      </div>
    </div>
  )
}
