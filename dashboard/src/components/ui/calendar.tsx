"use client"
import * as React from "react"
import { DayPicker } from "react-day-picker"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

export function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months:          "flex flex-col sm:flex-row gap-4",
        month:           "space-y-4",
        month_caption:   "flex justify-center pt-1 relative items-center",
        caption_label:   "text-sm font-semibold text-foreground",
        nav:             "space-x-1 flex items-center",
        button_previous: "absolute left-1 h-7 w-7 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors",
        button_next:     "absolute right-1 h-7 w-7 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors",
        month_grid:      "w-full border-collapse space-y-1",
        weekdays:        "flex",
        weekday:         "text-muted-foreground rounded-md w-9 font-medium text-[0.7rem] text-center",
        week:            "flex w-full mt-2",
        day:             cn(
          "h-9 w-9 text-center text-sm p-0 relative",
          "focus-within:relative focus-within:z-20"
        ),
        day_button:      cn(
          "h-9 w-9 p-0 font-normal rounded-full flex items-center justify-center text-sm w-full",
          "hover:bg-muted hover:text-foreground transition-colors"
        ),
        selected:        "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground rounded-full",
        today:           "bg-accent/20 text-accent font-semibold",
        outside:         "text-muted-foreground opacity-50",
        disabled:        "text-muted-foreground opacity-30",
        hidden:          "invisible",
        range_end:       "rounded-r-full",
        range_start:     "rounded-l-full",
        range_middle:    "rounded-none",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) =>
          orientation === "left"
            ? <ChevronLeft size={16} />
            : <ChevronRight size={16} />,
      }}
      {...props}
    />
  )
}
