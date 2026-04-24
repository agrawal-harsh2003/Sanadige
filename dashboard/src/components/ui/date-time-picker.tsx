"use client"
import * as React from "react"
import { format } from "date-fns"
import { CalendarDays, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Calendar } from "@/components/ui/calendar"

interface DateTimePickerProps {
  value?: Date
  onChange: (date: Date | undefined) => void
  className?: string
  placeholder?: string
  disabled?: boolean
}

const TIME_SLOTS = [
  { label: 'Lunch', slots: ['12:00', '12:30', '13:00', '13:30', '14:00', '14:30'] },
  { label: 'Dinner', slots: ['19:00', '19:30', '20:00', '20:30', '21:00', '21:30', '22:00'] },
]

function parseTime(t: string) {
  const [h, m] = t.split(':').map(Number)
  return { h, m }
}

function formatSlot(t: string) {
  const { h, m } = parseTime(t)
  const period = h >= 12 ? 'PM' : 'AM'
  const hour = h > 12 ? h - 12 : h === 0 ? 12 : h
  return hour + ':' + m.toString().padStart(2, '0') + ' ' + period
}

export function DateTimePicker({
  value,
  onChange,
  className,
  placeholder,
  disabled,
}: DateTimePickerProps) {
  const ph = placeholder ?? "Pick date & time"
  const [open, setOpen] = React.useState(false)
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(value)
  const [selectedTime, setSelectedTime] = React.useState<string | undefined>(
    value
      ? value.getHours().toString().padStart(2, '0') + ':' + value.getMinutes().toString().padStart(2, '0')
      : undefined
  )

  React.useEffect(() => {
    if (!value) {
      setSelectedDate(undefined)
      setSelectedTime(undefined)
      setOpen(false)
    }
  }, [value])

  function buildResult(date: Date | undefined, time: string | undefined): Date | undefined {
    if (!date || !time) return undefined
    const { h, m } = parseTime(time)
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), h, m, 0, 0)
  }

  function handleDaySelect(day: Date | undefined) {
    setSelectedDate(day)
    onChange(buildResult(day, selectedTime))
  }

  function handleTimeSelect(time: string) {
    setSelectedTime(time)
    const result = buildResult(selectedDate, time)
    onChange(result)
    if (result) setOpen(false)
  }

  const displayValue = value
    ? format(value, "dd MMM yyyy, hh:mm aa")
    : null

  return (
    <div className={cn("relative", className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(o => !o)}
        className={cn(
          "flex h-10 w-full items-center gap-2 rounded-lg border border-input bg-input px-3 py-2 text-sm text-left",
          "hover:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30 transition-colors",
          !displayValue && "text-muted-foreground",
          open && "border-ring ring-2 ring-ring/30"
        )}
      >
        <CalendarDays size={15} className="text-muted-foreground flex-shrink-0" />
        <span className="flex-1">{displayValue ?? ph}</span>
        <ChevronDown size={14} className={cn("text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="mt-1.5 rounded-2xl border border-border bg-card shadow-lg overflow-hidden">
          <div className="flex divide-x divide-border">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={handleDaySelect}
              disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
              initialFocus
            />
            <div className="p-3 min-w-[160px]">
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground mb-3">Time</p>
              {!selectedDate && (
                <p className="text-xs text-muted-foreground">Select a date first</p>
              )}
              {selectedDate && (
                <div className="space-y-3">
                  {TIME_SLOTS.map(group => (
                    <div key={group.label}>
                      <p className="text-[10px] text-muted-foreground font-medium mb-1.5">{group.label}</p>
                      <div className="grid grid-cols-2 gap-1">
                        {group.slots.map(slot => (
                          <button
                            key={slot}
                            type="button"
                            onClick={() => handleTimeSelect(slot)}
                            className={cn(
                              "text-xs px-2 py-1.5 rounded-lg font-medium transition-colors text-center",
                              selectedTime === slot
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted hover:bg-primary/10 hover:text-primary text-foreground"
                            )}
                          >
                            {formatSlot(slot)}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
