import { type ClassValue, clsx } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

// Register the semantic spacing scale defined in app/globals.css so
// tailwind-merge can resolve conflicts between custom tokens (p-md, gap-lg,
// space-y-xl) and Tailwind's numeric scale (p-6, gap-4). Without this,
// overrides like cn("p-6 pt-0", "p-md") silently leave all three classes in
// place and the shadcn default wins on CSS source-order.
const SEMANTIC_SPACING = ["xs", "sm", "md", "lg", "xl", "2xl", "3xl", "4xl", "5xl"];

const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      spacing: SEMANTIC_SPACING,
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
