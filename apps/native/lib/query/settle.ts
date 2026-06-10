/**
 * The "data-settled" signal the verification harness capture gate waits on
 * (verification/ios-gate/capture-hygiene.mjs). Pattern ported from the
 * ks-digital reference.
 *
 * The capture gate must NOT fire on a skeleton/loading frame. Rather than a
 * screenshot heuristic, each data screen exposes a deterministic condition:
 * all of the screen's TanStack queries are `isSuccess || isError`. An errored
 * query still counts as settled — the screen then renders its styled error
 * surface, which is a stable frame to capture.
 *
 * Screens render a zero-size element carrying `DATA_SETTLED_LABEL` as its
 * `accessibilityLabel` once `useDataSettled(...)` returns true, so the
 * Maestro/a11y harness can poll the a11y tree for it.
 */

/** Minimal shape of a TanStack `useQuery` result needed to compute settle. */
export interface SettleStatus {
  isSuccess: boolean;
  isError: boolean;
}

/**
 * Pure settle predicate. True once every query has resolved (success or
 * error). Vacuously true for a screen with no queries.
 */
export function isSettled(statuses: SettleStatus[]): boolean {
  return statuses.every((s) => s.isSuccess || s.isError);
}

/** Accessibility label the harness polls for. */
export const DATA_SETTLED_LABEL = "data-settled";

/**
 * Hook form: pass the screen's query results and get a boolean that flips to
 * true only after all of them settle.
 */
export function useDataSettled(statuses: SettleStatus[]): boolean {
  return isSettled(statuses);
}
