/**
 * `GET /v1/courses` — course name search over the catalog.
 *
 * The first half of the resolve fitbull performs before it can write a round:
 * a course name yields a `courseId`, and `GET /v1/tees?courseId=…` turns that
 * into the `teeId` the write needs.
 *
 * ── Query parameters (FROZEN AT SHIP — §4) ────────────────────────────────
 * §4 makes narrowing validation after ship a BREAKING change requiring
 * `/v2`, and the contract left this route's parameters undecided
 * (`007-w6-fitbull-integration-notes.md` §10 item 2). Every choice below is
 * therefore deliberately the narrow one — a parameter can be added or
 * loosened later without a version bump; it can never be removed or
 * tightened.
 *
 *   `q`      REQUIRED, 1–100 chars. Case-insensitive substring match on the
 *            course name, the same `ILIKE '%q%'` tRPC has always used.
 *            Required rather than optional because relaxing a required
 *            parameter later is additive, whereas shipping "no `q` lists the
 *            catalog" commits us to an unpaginated full-catalog dump we
 *            could never take back. There is no browse endpoint in v1.
 *   `limit`  OPTIONAL, 1–50, default 10. The default is the cap tRPC has
 *            always applied, so behaviour matches the app surface when the
 *            parameter is omitted. 50 is a ceiling we can raise later.
 *
 * Everything else is OMITTED on purpose: no pagination cursor, no `offset`,
 * no country/city filter, no sort control. Each is additive later; each,
 * shipped now on a guess, would be permanent. A client that needs more than
 * 50 matches for one term should search more specifically.
 *
 * ── Response shape (FROZEN AT SHIP) ───────────────────────────────────────
 *   200 `{ "courses": [ { id, name, country, city, website } ] }`
 *
 * An OBJECT wrapper, not a bare top-level array: an array cannot gain a
 * sibling field, so pagination metadata could never be added without a
 * breaking change. `website` is always present and `null` when unknown,
 * rather than omitted, so tolerant readers see one shape. `approvalStatus`
 * is not exposed — every row is approved by construction, and publishing a
 * constant field freezes a promise we would have to keep.
 *
 * ── What this route does NOT do ───────────────────────────────────────────
 * No entitlement check. `plan_required` gates ROUND WRITES (contract §1's
 * `get_connected_entitlement()` exists to decide "may this account write
 * another round"); the catalog is reference data, identical for every
 * authenticated principal, and gating it would deny a client the very lookup
 * it needs to explain a 403 to its user.
 *
 * No scope check either. Every OAuth token today carries `rounds:write`
 * unconditionally, and §10 item 5 records that the corpus never says which
 * scope authorizes a read. Requiring `rounds:write` for a read would both
 * be a no-op today and be exactly wrong the day a read-only scope ships.
 *
 * Handler responsibilities, and nothing more: authenticate, rate-limit,
 * validate the query string, call the shared catalog service, serialize, map
 * errors. The query itself lives in `@/server/services/catalog`, shared with
 * tRPC.
 */
import { z } from "zod";

import {
  authenticateV1Request,
  errorResponse,
  jsonResponse,
  problemResponse,
  rateLimitResponse,
  v1RateLimitPrincipal,
  validationProblem,
} from "@/app/api/v1/_lib";
import { enforcePublicApiRateLimit } from "@/lib/rate-limit";
import {
  DEFAULT_COURSE_SEARCH_LIMIT,
  searchCatalogCourses,
  type CatalogCourse,
} from "@/server/services/catalog";

const ROUTE = "GET /v1/courses";

/** Ceiling on `limit`. Raising it later is additive; lowering it is not. */
export const MAX_COURSE_SEARCH_LIMIT = 50;

/** Longest accepted search term. */
const MAX_QUERY_LENGTH = 100;

/**
 * The query-string contract.
 *
 * `q` is trimmed before the length check so a whitespace-only term fails as
 * "too short" rather than reaching `ILIKE '%   %'` and matching everything
 * with a space in its name.
 */
const courseQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .min(1, "q must not be empty")
    .max(MAX_QUERY_LENGTH, `q must be at most ${MAX_QUERY_LENGTH} characters`),
  limit: z.coerce
    .number()
    .int("limit must be an integer")
    .min(1, "limit must be at least 1")
    .max(
      MAX_COURSE_SEARCH_LIMIT,
      `limit must be at most ${MAX_COURSE_SEARCH_LIMIT}`
    )
    .default(DEFAULT_COURSE_SEARCH_LIMIT),
});

/**
 * The wire shape. Explicit field-by-field rather than a spread, so a column
 * added to `CatalogCourse` cannot silently become part of the frozen public
 * contract.
 */
function serializeCourse(course: CatalogCourse) {
  return {
    id: course.id,
    name: course.name,
    country: course.country,
    city: course.city,
    website: course.website,
  };
}

export async function GET(request: Request): Promise<Response> {
  const instance = crypto.randomUUID();
  try {
    const auth = await authenticateV1Request(request, { instance });
    if (!auth.ok) return problemResponse(auth.problem);

    // Principal PARTS, never a composed key, and the family is ALWAYS named:
    // omitting it silently falls back to the legacy 60/min shared bucket
    // instead of the 120/min reads budget (see `_lib/rate-limit-seam.ts`).
    const limit = await enforcePublicApiRateLimit(
      request,
      v1RateLimitPrincipal(auth.principal),
      "reads"
    );
    if (!limit.success) return rateLimitResponse(limit, { instance });

    const url = new URL(request.url);
    const parsed = courseQuerySchema.safeParse({
      q: url.searchParams.get("q") ?? undefined,
      // `undefined` (absent) takes the schema default; an empty string is a
      // supplied-but-blank value and must fail validation, not coerce to 0.
      limit: url.searchParams.get("limit") ?? undefined,
    });
    if (!parsed.success) {
      return problemResponse(validationProblem(parsed.error, { instance }));
    }

    const courses = await searchCatalogCourses({
      query: parsed.data.q,
      limit: parsed.data.limit,
    });

    return jsonResponse({ courses: courses.map(serializeCourse) }, 200);
  } catch (error) {
    return errorResponse(error, {
      instance,
      route: ROUTE,
    });
  }
}
