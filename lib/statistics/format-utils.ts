/**
 * Safe number formatting utilities for statistics display
 * Prevents NaN, null, and undefined from displaying in the UI
 */

/**
 * Type guard to check if a value is a valid, finite number
 */
export function isValidNumber(value: unknown): value is number {
  return typeof value === "number" && !Number.isNaN(value) && Number.isFinite(value);
}

/**
 * Format a differential value safely
 * Returns "--" for invalid values, otherwise formats to 1 decimal place
 */
export function formatDifferential(value: number | null | undefined): string {
  if (!isValidNumber(value)) return "--";
  return value.toFixed(1);
}

/**
 * Format a percentage value safely
 * Returns "--" for invalid values, otherwise formats to 1 decimal place with % suffix
 */
export function formatPercentage(value: number | null | undefined): string {
  if (!isValidNumber(value)) return "--";
  return `${value.toFixed(1)}%`;
}

/**
 * Format a score value safely (whole number)
 * Returns "--" for invalid values, otherwise rounds to nearest integer
 */
export function formatScore(value: number | null | undefined): string {
  if (!isValidNumber(value)) return "--";
  return Math.round(value).toString();
}

/**
 * Format a decimal value safely to specified precision
 * Returns "--" for invalid values
 */
export function formatDecimal(
  value: number | null | undefined,
  precision: number = 2
): string {
  if (!isValidNumber(value)) return "--";
  return value.toFixed(precision);
}

/**
 * Format a number with locale-aware thousands separators
 * Returns "--" for invalid values
 */
export function formatNumber(value: number | null | undefined): string {
  if (!isValidNumber(value)) return "--";
  return value.toLocaleString();
}

/**
 * Format golf age from days to human readable string
 * Returns "--" for invalid values
 */
export function formatGolfAge(days: number | null | undefined): string {
  if (!isValidNumber(days) || days < 0) return "--";

  if (days < 30) return `${days} day${days !== 1 ? "s" : ""}`;
  if (days < 365) {
    const months = Math.floor(days / 30);
    return `${months} month${months !== 1 ? "s" : ""}`;
  }
  const years = (days / 365).toFixed(1);
  return `${years} years`;
}

/**
 * Format strokes per hole with context about par
 * Assumes average par is 4
 */
export function formatStrokesPerHole(
  value: number | null | undefined
): { display: string; context: string } {
  if (!isValidNumber(value)) {
    return { display: "--", context: "No data" };
  }

  const avgPar = 4;
  const overPar = value - avgPar;

  let context: string;
  if (Math.abs(overPar) < 0.05) {
    context = "Right at par!";
  } else if (overPar > 0) {
    context = `${overPar.toFixed(1)} over par avg`;
  } else {
    context = `${Math.abs(overPar).toFixed(1)} under par avg`;
  }

  return { display: value.toFixed(2), context };
}

/**
 * Format a value with a sign prefix (+ or -)
 * Returns "--" for invalid values
 */
export function formatWithSign(value: number | null | undefined, precision: number = 1): string {
  if (!isValidNumber(value)) return "--";
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(precision)}`;
}
