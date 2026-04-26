'use client'
import { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { seedTables } from '@/actions/tables'

export function SeedTablesButton() {
  const [, startTransition] = useTransition()
  return (
    <Button
      variant="outline"
      onClick={() => startTransition(() => seedTables())}
    >
      Seed Default Tables
    </Button>
  )
}
