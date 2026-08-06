"use client";

/**
 * Quarantine badge — the single web rendering of "this round was accepted but
 * doesn't count" (decision D4: quarantined rounds stay VISIBLE in every list
 * and are excluded only from handicap-derived statistics).
 *
 * Extracted from the homepage activity feed so every list that shows rounds
 * (activity feed, per-course rounds table, …) badges them identically — one
 * copy deck, one treatment, no drift. Native twin:
 * apps/native/components/billing/quarantine-badge.tsx.
 */
import { Lock } from "lucide-react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { analytics } from "@/lib/analytics";
import { cn } from "@/lib/utils";

/** Copy deck — mirrored verbatim in the native twin. */
export const QUARANTINE_BADGE_LABEL = "Not counted — free-tier limit reached";
export const QUARANTINE_BADGE_EXPLANATION =
  "This round was saved but doesn't count toward your handicap or statistics. Upgrade to unlock it.";
export const QUARANTINE_BADGE_CTA = "Upgrade to count it";

interface QuarantineBadgeProps {
  className?: string;
}

export function QuarantineBadge({ className }: QuarantineBadgeProps) {
  const router = useRouter();

  return (
    <div className={cn("flex flex-wrap items-center gap-sm", className)}>
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              variant="secondary"
              className="bg-warning/20 text-warning text-meta shrink-0 px-sm"
            >
              <Lock className="h-3 w-3 mr-xs" />
              {QUARANTINE_BADGE_LABEL}
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="top">
            {QUARANTINE_BADGE_EXPLANATION}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <button
        type="button"
        onClick={(event) => {
          // The badge can sit inside a linked row — never navigate the row.
          event.preventDefault();
          event.stopPropagation();
          analytics.capture("upgrade_clicked", {
            surface: "quarantined_round_badge",
          });
          router.push("/upgrade");
        }}
        className="text-meta-strong text-primary underline underline-offset-2 hover:text-primary-alternate focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
      >
        {QUARANTINE_BADGE_CTA}
      </button>
    </div>
  );
}
