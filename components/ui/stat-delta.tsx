import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

type StatDeltaProps = {
  /** Numeric delta. Zero renders the neutral icon. */
  value: number;
  /**
   * Set when a negative delta is the "better" direction (golf handicap,
   * stroke-over-par). Default: positive deltas are good.
   */
  invert?: boolean;
  /** Threshold under which the value is treated as unchanged. Default 0. */
  threshold?: number;
  /** Formatter for the numeric display. Defaults to signed one-decimal. */
  format?: (value: number) => string;
  className?: string;
  /** Hide the icon and show only the colored number. */
  iconOnly?: boolean;
  /** Hide the number and show only the colored icon. */
  numberOnly?: boolean;
};

const defaultFormat = (v: number) =>
  v > 0 ? `+${v.toFixed(1)}` : v.toFixed(1);

/**
 * Colored up/down indicator for "a value changed" stats. Unifies
 * handicap deltas, round improvement, score-over-par, etc. Encodes
 * the "lower is better" inversion once so callers don't re-implement
 * the sign flip each time.
 */
export function StatDelta({
  value,
  invert = false,
  threshold = 0,
  format = defaultFormat,
  className,
  iconOnly = false,
  numberOnly = false,
}: StatDeltaProps) {
  const isPositive = value > threshold;
  const isNegative = value < -threshold;
  const better = invert ? isNegative : isPositive;
  const worse = invert ? isPositive : isNegative;

  const tone = better
    ? "text-success"
    : worse
      ? "text-destructive"
      : "text-muted-foreground";

  const Icon = isPositive ? TrendingUp : isNegative ? TrendingDown : Minus;

  return (
    <span className={cn("inline-flex items-center gap-xs", tone, className)}>
      {!numberOnly && <Icon className="h-4 w-4" aria-hidden />}
      {!iconOnly && <span>{format(value)}</span>}
    </span>
  );
}
