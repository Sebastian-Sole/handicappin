"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, Upload, ScanSearch, FileCheck } from "lucide-react";

interface AiUpsellDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STEPS = [
  {
    icon: Upload,
    title: "Upload your scorecard",
    description:
      "Take a photo or upload an image of the scorecard from your golf course.",
  },
  {
    icon: ScanSearch,
    title: "AI reads the details",
    description:
      "Our AI analyzes the image and extracts tee ratings, par, handicaps, and distances.",
  },
  {
    icon: FileCheck,
    title: "Form fills automatically",
    description:
      "All the extracted data populates the form instantly. Just review and save.",
  },
];

const STEP_DURATION_MS = 3000;

export function AiUpsellDialog({ open, onOpenChange }: AiUpsellDialogProps) {
  const [currentStep, setCurrentStep] = useState(0);

  const advanceStep = useCallback(() => {
    setCurrentStep((previous) => (previous + 1) % STEPS.length);
  }, []);

  // Auto-advance steps when dialog is open
  useEffect(() => {
    if (!open) return;

    const interval = setInterval(advanceStep, STEP_DURATION_MS);
    return () => clearInterval(interval);
  }, [open, advanceStep]);

  // Reset to first step when dialog is opened
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setCurrentStep(0);
    }
    onOpenChange(newOpen);
  };

  const step = STEPS[currentStep];
  const StepIcon = step.icon;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-sm">
            <Sparkles className="h-5 w-5 text-primary" />
            Add with AI
          </DialogTitle>
        </DialogHeader>

        {/* Animated walkthrough area */}
        <div className="relative flex flex-col items-center justify-center h-48 rounded-lg bg-muted overflow-hidden">
          <div
            key={currentStep}
            className="flex flex-col items-center gap-md animate-in fade-in slide-in-from-bottom-4 duration-500"
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <StepIcon className="h-8 w-8 text-primary" />
            </div>
            <p className="text-sm font-medium">{step.title}</p>
          </div>
        </div>

        {/* Step indicators */}
        <div className="flex justify-center gap-sm">
          {STEPS.map((_, stepIndex) => (
            <button
              key={stepIndex}
              type="button"
              onClick={() => setCurrentStep(stepIndex)}
              className={`h-2 rounded-full transition-all duration-300 ${
                stepIndex === currentStep
                  ? "w-6 bg-primary"
                  : "w-2 bg-muted-foreground/30"
              }`}
              aria-label={`Go to step ${stepIndex + 1}`}
            />
          ))}
        </div>

        {/* Step description */}
        <p
          key={`desc-${currentStep}`}
          className="text-center text-sm text-muted-foreground animate-in fade-in duration-500"
        >
          {step.description}
        </p>

        {/* CTA */}
        <div className="flex flex-col gap-sm pt-sm">
          <Button asChild>
            <Link href="/upgrade">Upgrade to Premium</Link>
          </Button>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Maybe later
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
