"use client";

import { InfoIcon } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type WhatsThisProps = {
  /** Tooltip body. Keep concise — wraps to a ~15em container. */
  children: ReactNode;
  /** Hide the "What's this?" caption on small screens. Default true. */
  captionResponsive?: boolean;
  /** Caption shown beside the icon. Default "What's this?". */
  caption?: string;
  className?: string;
};

/**
 * Info-icon + optional caption that reveals explanatory text on hover /
 * focus. Replaces the 13-line Tooltip+InfoIcon+TooltipContent dance
 * scattered across calculators and stats labels.
 */
export function WhatsThis({
  children,
  captionResponsive = true,
  caption = "What's this?",
  className,
}: WhatsThisProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          className={cn(
            "inline-flex items-center text-muted-foreground gap-sm",
            className
          )}
          aria-label={caption}
          type="button"
        >
          <InfoIcon className="h-5 w-5" aria-hidden />
          <span className={cn(captionResponsive && "hidden sm:inline")}>
            {caption}
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-[15em]">{children}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
