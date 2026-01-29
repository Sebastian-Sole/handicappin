"use client";

import { useState } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { CalculatorMeta } from "@/types/calculators";
import { useCalculatorContext } from "@/contexts/calculatorContext";

interface CalculatorCardProps {
  meta: CalculatorMeta;
  children: React.ReactNode;
  result?: React.ReactNode;
  explanation?: React.ReactNode;
  className?: string;
}

export function CalculatorCard({
  meta,
  children,
  result,
  explanation,
  className,
}: CalculatorCardProps) {
  const [showExplanation, setShowExplanation] = useState(false);
  const { expandedCalculator, setExpandedCalculator } = useCalculatorContext();

  const isExpanded = expandedCalculator === meta.id;

  // On mobile, use accordion behavior
  const handleToggle = () => {
    setExpandedCalculator(isExpanded ? null : meta.id);
  };

  return (
    <Card className={cn("transition-all", className)}>
      <CardHeader
        className="cursor-pointer md:cursor-default"
        onClick={handleToggle}
      >
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg sm:text-xl">{meta.name}</CardTitle>
            <CardDescription className="mt-1">
              {meta.description}
            </CardDescription>
          </div>
          {/* Mobile expand indicator */}
          <div className="md:hidden">
            {isExpanded ? (
              <ChevronUp className="h-5 w-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
        </div>
      </CardHeader>

      {/* Content - always visible on desktop, accordion on mobile */}
      <CardContent
        className={cn(
          "space-y-4",
          "md:block", // Always show on desktop
          isExpanded ? "block" : "hidden md:block" // Accordion on mobile
        )}
      >
        {/* Input Fields */}
        {children}

        {/* Result Display */}
        {result && <div className="pt-4 border-t">{result}</div>}

        {/* Collapsible Explanation */}
        {explanation && (
          <Collapsible open={showExplanation} onOpenChange={setShowExplanation}>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-between"
              >
                <span>How is this calculated?</span>
                {showExplanation ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-4 space-y-4">
              {explanation}
              {meta.usgaLink && (
                <a
                  href={meta.usgaLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  Learn more at USGA.org
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
}
