import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        caption: "flex justify-center pt-1 relative items-center pb-2",
        caption_label: "text-sm font-semibold text-gray-900",
        nav: "space-x-1 flex items-center justify-between absolute w-full",
        nav_button: cn(
          buttonVariants({ variant: "outline" }),
          "h-8 w-8 p-0 border-[#0A5C3A]/20 hover:bg-[#0A5C3A]/10 hover:border-[#0A5C3A]/40 bg-white text-[#0A5C3A]"
        ),
        nav_button_previous: "left-1",
        nav_button_next: "right-1",
        table: "w-full border-collapse space-y-1 mt-2",
        head_row: "flex",
        head_cell:
          "text-gray-700 rounded-md w-9 font-semibold text-[0.75rem] h-8 flex items-center justify-center",
        row: "flex w-full mt-2",
        cell: "h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-[#0A5C3A]/15 [&:has([aria-selected])]:bg-[#0A5C3A]/20 first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
        day: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 p-0 font-normal rounded-md hover:bg-[#0A5C3A]/10 aria-selected:opacity-100"
        ),
        day_range_end: "day-range-end",
        day_selected:
          "bg-[#0A5C3A] text-white hover:bg-[#0A5C3A] hover:text-white focus:bg-[#0A5C3A] focus:text-white font-semibold",
        day_today: "bg-[#0A5C3A]/20 text-[#0A5C3A] font-semibold border border-[#0A5C3A]/30",
        day_outside:
          "day-outside text-gray-400 opacity-50 aria-selected:bg-[#0A5C3A]/15 aria-selected:text-[#0A5C3A] aria-selected:opacity-70",
        day_disabled: "text-gray-300 opacity-40 cursor-not-allowed",
        day_range_middle:
          "aria-selected:bg-[#0A5C3A]/20 aria-selected:text-[#0A5C3A] rounded-none",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        IconLeft: ({ ...props }) => <ChevronLeft className="h-4 w-4" />,
        IconRight: ({ ...props }) => <ChevronRight className="h-4 w-4" />,
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
