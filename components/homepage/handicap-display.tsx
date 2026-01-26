"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface HandicapDisplayProps {
  handicapIndex: number;
  previousHandicapIndex?: number;
  className?: string;
}

export function HandicapDisplay({
  handicapIndex,
  previousHandicapIndex,
  className,
}: HandicapDisplayProps) {
  const [displayValue, setDisplayValue] = useState(0);

  // Animate the number on mount (works for positive, negative, and zero values)
  useEffect(() => {
    const duration = 1000;
    const steps = 60;
    const startValue = 0;
    const totalChange = handicapIndex - startValue;
    const increment = totalChange / steps;
    let current = startValue;
    let stepCount = 0;

    const timer = setInterval(() => {
      stepCount++;
      current += increment;

      // Use step count to determine completion (works for any direction)
      if (stepCount >= steps) {
        setDisplayValue(handicapIndex);
        clearInterval(timer);
      } else {
        setDisplayValue(Math.round(current * 10) / 10);
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [handicapIndex]);

  // Explicit check for previous handicap (0 and negative are valid values)
  const hasPreviousHandicap =
    previousHandicapIndex !== undefined && previousHandicapIndex !== null;

  const change = hasPreviousHandicap
    ? handicapIndex - previousHandicapIndex
    : 0;

  // Use absolute change instead of percentage for clearer UX
  // (percentage from negative or zero base is confusing)
  const absoluteChange = Math.abs(change).toFixed(1);

  return (
    <div className={cn("flex flex-col items-center lg:items-start", className)}>
      <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">
        Handicap Index
      </p>
      <div className="relative" aria-live="polite" aria-atomic="true">
        <span className="text-6xl md:text-7xl lg:text-8xl font-bold text-foreground tabular-nums">
          {displayValue.toFixed(1)}
        </span>
        <span className="sr-only">
          Current handicap index: {handicapIndex.toFixed(1)}
        </span>
      </div>
      {hasPreviousHandicap && change !== 0 && (
        <div
          className={cn(
            "flex items-center gap-1 mt-3 px-3 py-1 rounded-full text-sm font-medium",
            change < 0
              ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
              : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
          )}
        >
          {change < 0 ? (
            <ArrowDown className="h-4 w-4" />
          ) : (
            <ArrowUp className="h-4 w-4" />
          )}
          <span>{absoluteChange} from first round</span>
        </div>
      )}
    </div>
  );
}
