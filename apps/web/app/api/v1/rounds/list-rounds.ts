/**
 * `GET /v1/rounds` — the query contract and the read itself.
 *
 * Everything the route handler would otherwise inline lives here, so the
 * handler is guards + wiring and nothing else.
 *
 * ── WHY THE CHOICES BELOW ARE FROZEN ──────────────────────────────────────
 * `007-w6-fitbull-integration-notes.md` §10.3 lists this route's filtering,
 * ordering and pagination as **undecided** — including whether it can be
 * queried by `externalId`, "the query fitbull most obviously wants". T13.3
 * decides them, and contract §4 makes the decision one-way: **adding** a
 * parameter later is non-breaking, **removing or narrowing** one is a `/v2`.
 * So every choice below is the conservative side of that asymmetry — accept
 * as little as we can defend, promise as little as we can defend, and leave
 * room to widen.
 *
 * This endpoint exists for **write reconciliation, not display**: fitbull
 * never renders a handicap, it answers "did the round I sent get stored, and
 * what happened to it". That is what the parameter set is sized for.
 */

import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/supabase";
import {
  serializeV1Round,
  v1RoundSourceFromTableRow,
  type V1RoundResource,
  type V1RoundTableRow,
} from "@/app/api/v1/_lib/serializers/round";

/**
 * Page size when the client does not ask (`limit` omitted).
 *
 * 50 rather than "everything": an unbounded default would make one request's
 * cost proportional to a user's entire history, and the reads budget is
 * 120/min per principal (§3), not 120 unbounded scans.
 */
export const V1_ROUNDS_DEFAULT_LIMIT = 50;

/**
 * Largest accepted `limit`.
 *
 * 100 is chosen to be a number we never want to LOWER, because lowering it
 * post-ship is a narrowing and therefore a `/v2` (§4). Raising it is free.
 */
export const V1_ROUNDS_MAX_LIMIT = 100;

/** Digits only — no signs, no exponents, no whitespace. */
const NON_NEGATIVE_INTEGER = /^\d+$/;

/**
 * A query parameter that may appear **at most once**.
 *
 * A repeated parameter has no single sensible reading (first? last? OR?), and
 * quietly picking one hides a client bug on a reconciliation path. Rejecting
 * it is safe in the §4 sense: today's rejection can be widened into a
 * multi-value filter later without breaking a client that never sent two.
 */
function atMostOnce(name: string) {
  return z
    .array(z.string())
    .max(1, `${name} may appear at most once`)
    // The annotation is load-bearing: an absent parameter is an EMPTY array,
    // so this really does produce `undefined`, and without it TypeScript
    // infers `string` and the `.optional()` pipes below stop type-checking.
    .transform((values): string | undefined => values[0]);
}

/** A `limit`/`offset`-style parameter: optional, digits only, then bounded. */
function boundedInteger(
  name: string,
  bounds: { min: number; max?: number },
  fallback: number
) {
  let numeric = z.number().int().min(bounds.min, `${name} must be at least ${bounds.min}`);
  if (bounds.max !== undefined) {
    numeric = numeric.max(bounds.max, `${name} must be at most ${bounds.max}`);
  }
  return atMostOnce(name)
    .pipe(
      z
        .string()
        .regex(NON_NEGATIVE_INTEGER, `${name} must be a non-negative integer`)
        .transform(Number)
        .pipe(numeric)
        .optional()
    )
    .transform((value) => value ?? fallback);
}

/**
 * The complete accepted query surface. Three parameters, deliberately.
 *
 * **`externalId`** — exact match on the client's own idempotency key (§2).
 * This is the reconciliation query, so it is the one filter that ships. It is
 * deliberately **unbounded in length and unconstrained in format**: §10.8
 * leaves `externalId`'s format open, T13.4 owns the write-side constraint,
 * and a read filter stricter than the write path would make a stored round
 * unqueryable by the key it was stored under. Empty string is rejected
 * because no round can carry it (`""` is not a key a client meant to send).
 *
 * **`limit` / `offset`** — offset pagination, not a cursor. A cursor would
 * have to encode the sort key, which freezes the ordering into an opaque
 * token; offset keeps ordering and pagination independent so a future
 * `order`/`cursor` parameter is a pure addition.
 *
 * **Not shipped, on purpose** (each is a later, non-breaking addition):
 * a `status` filter (a client can read `status` off the entries it already
 * receives), a tee-time range, a multi-value `externalId`, a total count, and
 * any client-chosen ordering.
 *
 * **Unknown query parameters are IGNORED**, not rejected. A hard failure on
 * an unrecognized parameter is brittle for a server-to-server client whose
 * infrastructure may append its own, and the failure mode of ignoring is
 * benign here: a mistyped filter returns a superset, and every entry carries
 * `externalId`, so the client can still complete the reconciliation.
 */
export const v1RoundsQuerySchema = z.object({
  externalId: atMostOnce("externalId").pipe(
    z.string().min(1, "externalId must not be empty").optional()
  ),
  limit: boundedInteger(
    "limit",
    { min: 1, max: V1_ROUNDS_MAX_LIMIT },
    V1_ROUNDS_DEFAULT_LIMIT
  ),
  offset: boundedInteger("offset", { min: 0 }, 0),
});

export type V1RoundsQuery = z.infer<typeof v1RoundsQuerySchema>;

/** Every parameter this route reads, as `getAll` arrays (duplicates visible). */
export function readV1RoundsQuery(url: URL): Record<string, string[]> {
  return {
    externalId: url.searchParams.getAll("externalId"),
    limit: url.searchParams.getAll("limit"),
    offset: url.searchParams.getAll("offset"),
  };
}

/**
 * The response envelope.
 *
 * An object rather than a bare array: a bare JSON array can never gain a
 * sibling field without a breaking change, and pagination metadata is exactly
 * the sibling a list grows. `pagination` carries no `total` — a count query
 * doubles the read's cost and `hasMore` is what a paging client acts on.
 * `total` remains addable.
 */
export interface V1RoundsPage {
  data: V1RoundResource[];
  pagination: {
    limit: number;
    offset: number;
    /** Entries in THIS page. */
    count: number;
    /** Whether at least one more row exists after this page. */
    hasMore: boolean;
  };
}

/**
 * The columns `/v1` reads. Explicit rather than `*` so a future column cannot
 * arrive on the wire by accident, and so the read is the smallest row the
 * serializer needs.
 */
const ROUND_COLUMNS = [
  "id",
  "externalId",
  "quarantined",
  "courseId",
  "teeId",
  "teeTime",
  "nine_hole_section",
  "notes",
  "holes_played",
  "totalStrokes",
  "parPlayed",
  "adjustedGrossScore",
  "adjustedPlayedScore",
  "courseHandicap",
  "scoreDifferential",
  "updatedHandicapIndex",
  "course_rating_used",
  "slope_rating_used",
  "createdAt",
  "updated_at",
].join(", ");

/**
 * A round-list read failure, carrying PostgREST's SQLSTATE so the central
 * mapper can route `42501` to `403 forbidden` and everything else to
 * `500 internal_error` + Sentry (§1). The raw message never reaches the wire.
 */
export class V1RoundsReadError extends Error {
  constructor(
    message: string,
    readonly code?: string
  ) {
    super(message);
    this.name = "V1RoundsReadError";
  }
}

/**
 * Read one page of the principal's rounds.
 *
 * `client` MUST be an RLS-scoped, bearer-token client
 * (`createBearerTokenSupabaseClient`), never the service-role client and
 * never the Drizzle connection: RLS's `auth.uid() = "userId"` policy is the
 * control that actually holds cross-user isolation, and it only holds when
 * the request carries the principal's own token.
 *
 * **`userId` is a second, independent scoping predicate.** It is redundant
 * while the RLS policy stands, and that is the point — it is the layer that
 * still holds if a future migration loosens the policy, and it makes the
 * scoping visible in the code rather than only in the database.
 *
 * ── Quarantined rounds are NOT filtered ──────────────────────────────────
 * No `quarantined` predicate appears below, deliberately, matching
 * `server/api/routers/round.ts:getAllByUserId` and decision D4: a round the
 * API accepted with a 201 stays visible in lists, distinguished by
 * `status: "quarantined"`. The two *statistical* sites in that same router
 * (`getCountByUserId`, `getBestRound`) DO filter, because those feed the
 * handicap and the free-tier count. A reconciliation list is neither.
 * `approvalStatus` is likewise not filtered — it is a course-data moderation
 * axis, not a round-visibility one.
 *
 * ── Ordering ─────────────────────────────────────────────────────────────
 * `teeTime DESC, id DESC` — the same total order `getAllByUserId` already
 * uses, so the product has one round ordering rather than two. `teeTime`
 * alone is not total (two rounds can share a tee time; the natural key
 * permits it across different tees), and a non-total order makes offset
 * pagination silently drop and duplicate rows.
 */
export async function listV1Rounds(
  client: SupabaseClient<Database>,
  userId: string,
  query: V1RoundsQuery
): Promise<V1RoundsPage> {
  const { limit, offset, externalId } = query;

  // Fetch one extra row: `hasMore` without a second count query.
  const upperBound = offset + limit; // inclusive `.range` end ⇒ limit + 1 rows
  let builder = client
    .from("round")
    .select(ROUND_COLUMNS)
    .eq("userId", userId)
    .order("teeTime", { ascending: false })
    .order("id", { ascending: false })
    .range(offset, upperBound);

  if (externalId !== undefined) {
    builder = builder.eq("externalId", externalId);
  }

  const { data, error } = await builder;

  if (error) {
    throw new V1RoundsReadError(
      error.message ?? "round list read failed",
      error.code ?? undefined
    );
  }

  const rows = (data ?? []) as unknown as V1RoundTableRow[];
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  return {
    data: page.map((row) => serializeV1Round(v1RoundSourceFromTableRow(row))),
    pagination: { limit, offset, count: page.length, hasMore },
  };
}
