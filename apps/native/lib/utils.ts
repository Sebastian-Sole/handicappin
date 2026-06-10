/** Native twin of apps/web/lib/utils.ts — same cn() so class recipes diff 1:1. */
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
