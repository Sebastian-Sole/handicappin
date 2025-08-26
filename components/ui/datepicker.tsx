"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { format } from "date-fns";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface Calendar24Props {
  value?: Date;
  onChange: (date: Date) => void;
}

export default function DatePicker({ value, onChange }: Calendar24Props) {
  const [open, setOpen] = React.useState(false);

  // Initialize date and time from the value prop
  const [date, setDate] = React.useState<Date | undefined>(() => {
    return value && !isNaN(value.getTime()) ? value : undefined;
  });
  const [time, setTime] = React.useState(() => {
    return value && !isNaN(value.getTime()) ? format(value, "HH:mm") : "00:00";
  });

  // Update local state when value prop changes
  React.useEffect(() => {
    if (value && !isNaN(value.getTime())) {
      setDate(value);
      setTime(format(value, "HH:mm"));
    }
  }, [value]);

  // Combine date and time into a single Date object
  const combinedDateTime = React.useMemo(() => {
    if (!date) return undefined;

    const [hours, minutes] = time.split(":").map(Number);
    const newDate = new Date(date);
    newDate.setHours(hours, minutes, 0, 0);
    return newDate;
  }, [date, time]);

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = e.target.value;
    setTime(newTime);

    // Update the combined datetime and call onChange
    if (date) {
      const [hours, minutes] = newTime.split(":").map(Number);
      const newDate = new Date(date);
      newDate.setHours(hours, minutes, 0, 0);
      onChange(newDate);
    }
  };

  const handleDateSelect = (selectedDate: Date) => {
    setDate(selectedDate);

    // Combine with current time and call onChange
    const [hours, minutes] = time.split(":").map(Number);
    const newDate = new Date(selectedDate);
    newDate.setHours(hours, minutes, 0, 0);
    onChange(newDate);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          id="date-picker"
          className="w-full justify-between font-normal"
        >
          {value && !isNaN(value.getTime())
            ? format(value, "PPP HH:mm")
            : "Select date and time"}
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto overflow-hidden p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          captionLayout="dropdown"
          onSelect={(date) => {
            if (date) {
              handleDateSelect(date);
            }
          }}
        />
        <Separator />
        <div className="bg-background p-3 space-y-3">
          <Input
            type="time"
            id="time-picker"
            step="60"
            value={time}
            onChange={handleTimeChange}
            className="bg-background appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none flex justify-center"
          />
          <Button onClick={() => setOpen(false)} className="w-full">
            Close
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
