"use client";

// Spacing skipped (no token equivalent): w-10/h-10 (2.5rem), w-5/h-5 (1.25rem), h-0.5 (0.125rem); ring-4 is ring-width, not spacing.
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface Step {
  id: number;
  title: string;
  description?: string;
}

interface CalculationStepperProps {
  steps: Step[];
  currentStep?: number;
  className?: string;
}

export function CalculationStepper({
  steps,
  currentStep,
  className,
}: CalculationStepperProps) {
  return (
    <nav aria-label="Calculation steps" className={cn("w-full", className)}>
      <ol className="flex items-center">
        {steps.map((step, index) => {
          const isCompleted = currentStep !== undefined && step.id < currentStep;
          const isCurrent = currentStep === step.id;
          const isLast = index === steps.length - 1;

          return (
            <li key={step.id} className={cn("flex items-center", isLast ? "flex-none" : "flex-1")}>
              <div className="flex flex-col items-center">
                <div
                  aria-label={`Step ${step.id}: ${step.title}${isCompleted ? ", completed" : isCurrent ? ", current step" : ""}`}
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center text-badge transition-colors duration-200",
                    isCompleted && "bg-primary text-primary-foreground",
                    isCurrent && "bg-primary text-primary-foreground ring-4 ring-primary/20",
                    !isCompleted && !isCurrent && "bg-muted text-muted-foreground"
                  )}
                >
                  {isCompleted ? <Check className="w-5 h-5" aria-hidden="true" /> : step.id}
                </div>
                <span
                  className={cn(
                    "mt-sm text-meta text-center sr-only sm:not-sr-only transition-colors duration-200",
                    (isCompleted || isCurrent) ? "text-foreground font-medium" : "text-muted-foreground"
                  )}
                >
                  {step.title}
                </span>
              </div>
              {!isLast && (
                <div
                  className={cn(
                    "flex-1 h-0.5 mx-sm transition-colors duration-200",
                    isCompleted ? "bg-primary" : "bg-muted"
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
