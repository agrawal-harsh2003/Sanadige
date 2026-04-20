'use client'
import { useState, useTransition } from 'react'
import { updateStaffRole, removeStaff } from '@/actions/staff'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

const ROLE_COLORS: Record<string, string> = {
  manager: 'bg-accent',
  chef: 'bg-amber-500',
  host: 'bg-primary',
}

const ROLE_BADGE: Record<string, string> = {
  manager: 'bg-accent/10 text-accent ring-1 ring-accent/20',
  chef: 'bg-amber-50 text-amber-800 ring-1 ring-amber-200',
  host: 'bg-primary/10 text-primary ring-1 ring-primary/20',
}

const ROLE_LABEL: Record<string, string> = {
  manager: 'Manager',
  chef: 'Chef',
  host: 'Host',
}

interface StaffCardProps {
  id: string
  name: string
  phone: string
  role: string
  created_at: string
  isPrimary?: boolean
}

export function StaffCard({ id, name, phone, role, created_at, isPrimary }: StaffCardProps) {
  const [editing, setEditing] = useState(false)
  const [, startTransition] = useTransition()

  function handleRoleChange(newRole: string | null) {
    if (!newRole) return
    startTransition(async () => {
      await updateStaffRole(id, newRole)
      setEditing(false)
    })
  }

  function handleDelete() {
    if (!confirm(`Remove ${name} from staff?`)) return
    startTransition(() => removeStaff(id))
  }

  return (
    <div className={`bg-card shadow-sm ring-1 ring-black/5 rounded-2xl p-5 flex items-center gap-4 ${isPrimary ? 'border-l-4 border-accent' : ''}`}>
      <div className={`w-12 h-12 rounded-full ${ROLE_COLORS[role] ?? 'bg-muted'} flex items-center justify-center flex-shrink-0`}>
        <span className="text-white font-bold text-lg">{name[0]?.toUpperCase()}</span>
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-foreground">{name}</p>
          {isPrimary && (
            <span className="text-xs bg-accent/10 text-accent px-2 py-0.5 rounded-full font-medium ring-1 ring-accent/20">✓ Primary</span>
          )}
        </div>
        <p className="text-sm text-muted-foreground">{phone}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Added {new Date(created_at).toLocaleDateString('en-IN')}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {editing ? (
          <Select defaultValue={role} onValueChange={handleRoleChange}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              {['manager', 'chef', 'host'].map(r => (
                <SelectItem key={r} value={r}>{r}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <>
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${ROLE_BADGE[role] ?? 'bg-muted text-muted-foreground'}`}>
              {ROLE_LABEL[role] ?? role}
            </span>
            <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>Edit</Button>
            {!isPrimary && (
              <Button
                variant="ghost" size="sm"
                onClick={handleDelete}
                className="text-red-500 hover:text-red-700"
              >
                ✕
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
