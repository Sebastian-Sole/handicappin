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

  // Animate the number on mount
  useEffect(() => {
    const duration = 1000;
    const steps = 60;
    const increment = handicapIndex / steps;
    let current = 0;

    const timer = setInterval(() => {
      current += increment;
      if (current >= handicapIndex) {
        setDisplayValue(handicapIndex);
        clearInterval(timer);
      } else {
        setDisplayValue(Math.round(current * 10) / 10);
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [handicapIndex]);

  const change = previousHandicapIndex
    ? handicapIndex - previousHandicapIndex
    : 0;

  const changePercent = previousHandicapIndex
    ? ((change / previousHandicapIndex) * 100).toFixed(1)
    : "0";

  return (
    <div className={cn("flex flex-col items-center lg:items-start", className)}>
      <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">
        Handicap Index
      </p>
      <div className="relative">
        <span className="text-6xl md:text-7xl lg:text-8xl font-bold text-foreground tabular-nums">
          {displayValue.toFixed(1)}
        </span>
      </div>
      {previousHandicapIndex && change !== 0 && (
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
          <span>{Math.abs(Number(changePercent))}% from first round</span>
        </div>
      )}
    </div>
  );
}
