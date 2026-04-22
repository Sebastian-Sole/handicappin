import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type StatTileSize = "sm" | "md" | "lg";

type StatTileProps = {
  /** Centered bold value. Accepts number, string, or element (for inline icons). */
  value: ReactNode;
  /** Muted caption shown below the value. */
  label: ReactNode;
  /** Optional tertiary hint shown below the label (smaller, more muted). */
  hint?: ReactNode;
  /** Optional leading emoji / icon rendered above the value. */
  leading?: ReactNode;
  /** Controls the value font size. Default "md" (text-2xl). */
  size?: StatTileSize;
  className?: string;
};

const valueSize: Record<StatTileSize, string> = {
  sm: "text-figure-sm",
  md: "text-figure",
  lg: "text-figure-lg",
};

/**
 * Centered stat tile — bold value + muted caption. The recurring
 * "number with a label under it" pattern seen in round summaries,
 * dashboards, marketing stats, and statistics sections. Composes
 * cleanly inside `surface`, `surface-muted`, and `tint-*` containers.
 */
export function StatTile({
  value,
  label,
  hint,
  leading,
  size = "md",
  className,
}: StatTileProps) {
  return (
    <div className={cn("text-center", className)}>
      {leading && <div className="mb-xs">{leading}</div>}
      <div className={valueSize[size]}>{value}</div>
      <p className="text-sm text-muted-foreground">{label}</p>
      {hint && (
        <p className="text-xs text-muted-foreground/70 mt-xs">{hint}</p>
      )}
    </div>
  );
}
