'use client'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { format, addDays, parseISO, isToday } from 'date-fns'

export function DateNav({ date }: { date: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function go(offset: number) {
    const next = addDays(parseISO(date), offset)
    const params = new URLSearchParams(searchParams.toString())
    params.set('date', format(next, 'yyyy-MM-dd'))
    router.push(`?${params.toString()}`)
  }

  const parsed = parseISO(date)
  const todayDate = format(new Date(), 'yyyy-MM-dd')

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => go(-1)}
        className="h-8 w-8 flex items-center justify-center rounded-lg border border-border bg-card hover:bg-muted transition-colors"
      >
        <ChevronLeft size={16} className="text-muted-foreground" />
      </button>
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-card min-w-[160px] justify-center">
        <span className="text-sm font-semibold text-foreground">
          {format(parsed, 'EEE, d MMM yyyy')}
        </span>
        {isToday(parsed) && (
          <span className="text-[10px] font-bold uppercase tracking-wide text-primary bg-primary/10 px-1.5 py-0.5 rounded">Today</span>
        )}
      </div>
      <button
        onClick={() => go(1)}
        className="h-8 w-8 flex items-center justify-center rounded-lg border border-border bg-card hover:bg-muted transition-colors"
      >
        <ChevronRight size={16} className="text-muted-foreground" />
      </button>
      {date !== todayDate && (
        <button
          onClick={() => {
            const params = new URLSearchParams(searchParams.toString())
            params.set('date', todayDate)
            router.push(`?${params.toString()}`)
          }}
          className="text-xs font-medium text-primary hover:underline px-2"
        >
          Today
        </button>
      )}
    </div>
  )
}
