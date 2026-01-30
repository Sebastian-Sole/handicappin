"use client";

import { useCalculatorContext } from "@/contexts/calculatorContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, RotateCcw } from "lucide-react";

export function LinkedValuesBar() {
  const { values, resetValues } = useCalculatorContext();

  // Only show values that have been set
  const activeValues = [
    values.handicapIndex !== null && {
      label: "HI",
      value: values.handicapIndex.toFixed(1),
    },
    values.courseHandicap !== null && {
      label: "Course HCP",
      value: values.courseHandicap.toString(),
    },
    values.scoreDifferential !== null && {
      label: "Diff",
      value: values.scoreDifferential.toFixed(1),
    },
    values.courseRating !== null && {
      label: "CR",
      value: values.courseRating.toFixed(1),
    },
    values.slopeRating !== null && {
      label: "Slope",
      value: values.slopeRating.toString(),
    },
  ].filter(Boolean) as { label: string; value: string }[];

  if (activeValues.length === 0) return null;

  return (
    <div className="sticky top-16 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
      <div className="container mx-auto px-4 py-2">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            <span className="text-sm text-muted-foreground whitespace-nowrap">
              Linked:
            </span>
            {activeValues.map((item, idx) => (
              <span key={item.label} className="flex items-center gap-1">
                {idx > 0 && (
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                )}
                <Badge variant="secondary" className="whitespace-nowrap">
                  {item.label}: {item.value}
                </Badge>
              </span>
            ))}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={resetValues}
            className="shrink-0"
          >
            <RotateCcw className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">Reset</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
