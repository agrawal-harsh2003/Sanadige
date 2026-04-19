'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

const INTERVAL_MS = 30_000

export function AutoRefresh() {
  const router = useRouter()
  useEffect(() => {
    const id = setInterval(() => router.refresh(), INTERVAL_MS)
    return () => clearInterval(id)
  }, [router])
  return null
}
