"use client"
import * as React from "react"
import { format } from "date-fns"
import { CalendarDays, Clock } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

interface DateTimePickerProps {
  value?: Date
  onChange: (date: Date | undefined) => void
  className?: string
  placeholder?: string
  disabled?: boolean
}

const HOURS = Array.from({ length: 15 }, (_, i) => i + 8) // 8 AM to 10 PM
const MINUTES = [0, 15, 30, 45]

export function DateTimePicker({
  value,
  onChange,
  className,
  placeholder = "Pick date & time",
  disabled,
}: DateTimePickerProps) {
  const [open, setOpen] = React.useState(false)
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(value)
  const [hour, setHour] = React.useState(value ? value.getHours() : 12)
  const [minute, setMinute] = React.useState(value ? Math.round(value.getMinutes() / 15) * 15 : 0)

  function buildResult(date: Date | undefined, h: number, m: number): Date | undefined {
    if (!date) return undefined
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), h, m, 0, 0)
  }

  function handleDaySelect(day: Date | undefined) {
    setSelectedDate(day)
    onChange(buildResult(day, hour, minute))
  }

  function handleHourChange(h: number) {
    setHour(h)
    onChange(buildResult(selectedDate, h, minute))
  }

  function handleMinuteChange(m: number) {
    setMinute(m)
    onChange(buildResult(selectedDate, hour, m))
  }

  const displayValue = value ? format(value, "dd MMM yyyy, hh:mm aa") : null
  const confirmDate = buildResult(selectedDate, hour, minute)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "flex h-10 w-full items-center gap-2 rounded-lg border border-input bg-input px-3 py-2 text-sm text-left",
            "hover:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30 transition-colors",
            !displayValue && "text-muted-foreground",
            className
          )}
        >
          <CalendarDays size={15} className="text-muted-foreground flex-shrink-0" />
          <span className="flex-1">{displayValue ?? placeholder}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto" align="start">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={handleDaySelect}
          disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
          initialFocus
        />
        <div className="border-t border-border px-4 py-3">
          <div className="flex items-center gap-2 mb-2">
            <Clock size={13} className="text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Time</span>
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <p className="text-[10px] text-muted-foreground mb-1">Hour</p>
              <div className="max-h-32 overflow-y-auto rounded-lg border border-border">
                {HOURS.map(h => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => handleHourChange(h)}
                    className={cn(
                      "w-full text-left px-3 py-1.5 text-sm hover:bg-muted transition-colors",
                      hour === h && "bg-primary text-primary-foreground hover:bg-primary"
                    )}
                  >
                    {h > 12 ? `${h - 12}` : h}:00 {h >= 12 ? 'PM' : 'AM'}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1">
              <p className="text-[10px] text-muted-foreground mb-1">Minute</p>
              <div className="rounded-lg border border-border overflow-hidden">
                {MINUTES.map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => handleMinuteChange(m)}
                    className={cn(
                      "w-full text-left px-3 py-1.5 text-sm hover:bg-muted transition-colors",
                      minute === m && "bg-primary text-primary-foreground hover:bg-primary"
                    )}
                  >
                    :{m.toString().padStart(2, '0')}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {confirmDate && (
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-3 w-full rounded-lg bg-primary text-primary-foreground text-sm font-semibold py-2 hover:bg-primary/90 transition-colors"
            >
              Confirm — {format(confirmDate, "dd MMM, hh:mm aa")}
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
