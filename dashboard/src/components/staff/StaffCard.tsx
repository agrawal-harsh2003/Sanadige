'use client'
import { useState, useTransition } from 'react'
import { updateStaffRole, removeStaff } from '@/actions/staff'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

const ROLE_COLORS: Record<string, string> = {
  manager: 'bg-green-500',
  chef: 'bg-orange-500',
  host: 'bg-blue-500',
}

const ROLE_BADGE: Record<string, string> = {
  manager: 'bg-green-100 text-green-800',
  chef: 'bg-orange-100 text-orange-800',
  host: 'bg-blue-100 text-blue-800',
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
    <div className={`bg-surface border rounded-xl p-5 flex items-center gap-4 ${isPrimary ? 'border-green-300 bg-green-50' : 'border-border'}`}>
      <div className={`w-12 h-12 rounded-full ${ROLE_COLORS[role] ?? 'bg-gray-400'} flex items-center justify-center flex-shrink-0`}>
        <span className="text-white font-bold text-lg">{name[0]?.toUpperCase()}</span>
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-[#1a2e1a]">{name}</p>
          {isPrimary && (
            <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full font-medium">✓ Primary</span>
          )}
        </div>
        <p className="text-sm text-text-muted">{phone}</p>
        <p className="text-xs text-text-muted mt-0.5">
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
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ROLE_BADGE[role] ?? ''}`}>
              {role}
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
