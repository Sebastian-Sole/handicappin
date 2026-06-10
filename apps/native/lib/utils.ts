/**
 * Native twin of apps/web/lib/utils.ts — same cn() contract so class recipes
 * diff 1:1 against web.
 *
 * Two tailwind-merge extensions matter here:
 * - the semantic spacing scale (p-md, gap-lg …), mirroring web's cn();
 * - the GENERATED typography ramp (text-heading-1, text-body, …) registered
 *   as font-size classes. Without this, twMerge classifies them as text
 *   COLORS, so cn("text-heading-1 text-foreground") silently drops the ramp
 *   class — native pairs ramp + color on every Text, web inherits color via
 *   the DOM cascade and never hits it.
 */
import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

import { tokens } from "@handicappin/tokens/tokens";

const SEMANTIC_SPACING = [
  "xs",
  "sm",
  "md",
  "lg",
  "xl",
  "2xl",
  "3xl",
  "4xl",
  "5xl",
];

/** "text-heading-1" → "heading-1" etc., straight from the generated contract. */
const TYPOGRAPHY_RAMP = Object.keys(tokens.typography).map((utility) =>
  utility.replace(/^text-/, ""),
);

const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      spacing: SEMANTIC_SPACING,
    },
    classGroups: {
      "font-size": [{ text: TYPOGRAPHY_RAMP }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
