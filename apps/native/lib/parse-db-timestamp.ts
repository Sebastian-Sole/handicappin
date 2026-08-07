/**
 * Parse a database timestamp string into a `Date` without shifting the instant.
 *
 * Mirror of `apps/web/lib/parse-db-timestamp.ts` (native reads the same
 * PostgREST-fed tRPC procedures, so it inherits the same defect).
 *
 * `round.teeTime` / `round.createdAt` are naive `timestamp` columns whose
 * stored value is the UTC rendering of the instant. PostgREST (supabase-js)
 * returns them zone-less, e.g. `"2026-07-15T18:30:00"`, and `new Date(value)`
 * parses such strings as *local* time — so in any zone east of UTC the
 * instant lands hours early and late-evening rounds render on the previous
 * date. This helper appends `Z` before parsing so the value is read back as
 * the UTC instant it is.
 *
 * Values that already carry an explicit zone (`Z` or a `±hh[:mm]` offset —
 * e.g. Drizzle-serialized ISO strings or `timestamptz` reads) pass through
 * unchanged; the offset is never double-applied.
 */
const EXPLICIT_ZONE_SUFFIX = /(?:Z|[+-]\d{2}(?::?\d{2})?)$/i;

export function parseDbTimestamp(value: string): Date;
export function parseDbTimestamp(value: null | undefined): null;
export function parseDbTimestamp(value: string | null | undefined): Date | null;
export function parseDbTimestamp(
  value: string | null | undefined
): Date | null {
  if (value == null) return null;
  // Date-only strings ("2026-07-15") are spec-parsed as UTC midnight already.
  if (!value.includes("T")) return new Date(value);
  // Hour-only offsets ("+02") are valid Postgres text output but not
  // parseable by JS Date — extend to "+02:00".
  if (/[+-]\d{2}$/.test(value)) return new Date(`${value}:00`);
  // Already zoned — parse as-is so the offset is not applied twice.
  if (EXPLICIT_ZONE_SUFFIX.test(value)) return new Date(value);
  return new Date(`${value}Z`);
}
