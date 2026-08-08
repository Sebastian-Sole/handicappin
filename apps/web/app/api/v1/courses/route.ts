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
 * `q` also rejects the NUL byte (`U+0000`) as a **422 `validation_failed`**
 * with the field code `q_contains_nul`. Postgres cannot store or bind a NUL
 * inside a `text` parameter — it raises SQLSTATE `22021` ("invalid byte
 * sequence for encoding UTF8: 0x00") — so `?q=%00` would otherwise reach the
 * driver, throw, and land in the central mapper as a **500 `internal_error`
 * plus a Sentry alert**, letting any token holder mint unlimited alerts from
 * inside its 120/min budget. This is the same reasoning `../tees/route.ts`
 * applies to `PG_MAX_INT`: bound the input here rather than let postgres
 * answer a client mistake with a 500. It is stated in the FROZEN section
 * because §4 makes turning a shipped 500 into a 422 a breaking change — the
 * guard is free now and impossible later.
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
 * ── RATE LIMITING: TWO buckets, IP first and then principal (§3) ──────────
 * Contract §3 names three identifiers, and the pre-auth one is not optional:
 * "**Pre-auth / invalid-token requests** (which still cost validation work
 * and must be limited): keyed `ip:{ip}` via the existing `CLIENT_IP_HEADERS`
 * trust order."
 *
 * That cost is real and is why the FIRST statement of the handler is a
 * limiter call. `authenticateV1Request` short-circuits without any network
 * only when the `Authorization` header is absent, unsplittable, wrongly
 * schemed, or empty; **every other token — `Bearer garbage`, or a
 * well-formed JWT with a bogus signature — goes to
 * `supabase.auth.getUser(token)`, an HTTP round trip to GoTrue**. Validation
 * is deliberately the network path (revocation is Supabase's answer to give,
 * see `_lib/principal.ts`), so an unauthenticated stranger holding no
 * credential at all can otherwise turn each cheap request into a GoTrue call.
 * Limiting only after authentication cannot reach that traffic: `getIdentifier`
 * prefers a `userId` over every IP header, so the `ip:` branch is never taken
 * on a route whose only limiter call happens once a principal exists.
 *
 * So the handler calls the limiter twice, with the same `reads` family:
 *
 *   1. **before** `authenticateV1Request`, with NO principal argument — so
 *      `getIdentifier` falls through to `ip:{ip}`. `GET /v1/health` does the
 *      same thing for the same reason; it is the template.
 *   2. **after**, with `v1RateLimitPrincipal(auth.principal)` — the
 *      `user:{sub}` / `client:{id}:user:{sub}` bucket that has always been
 *      here.
 *
 * The two key spaces are disjoint (`ip:…` can never collide with `user:…` or
 * `client:…`), so sharing the `reads` family costs nothing: an anonymous
 * flood exhausts IP buckets and cannot touch a legitimate client's budget.
 *
 * **The trade-off, stated rather than disclaimed.** An authenticated request
 * now spends one token from each bucket, so many users behind one NAT share
 * a 120/min IP bucket regardless of who they are. That is the shape §3
 * chose, and it is already the shape `/v1/health` ships; if carrier-NAT
 * clients start seeing 429s, the fix is a separate wider budget for the
 * pre-auth family, not deleting the pre-auth call. Note also that
 * `lib/rate-limit.ts` documents `cf-connecting-ip` as forgeable on the
 * grey-clouded API host — the IP bucket is a cost brake on casual
 * amplification, not flood protection. The Vercel WAF is the flood backstop.
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
 * Field-level code (§1, append-only namespace) for a `q` carrying a NUL byte.
 * Its own code rather than `too_small`/`invalid_string`, because the client's
 * remedy is different: strip the byte, not lengthen or shorten the term.
 */
export const NUL_IN_QUERY_FIELD_CODE = "q_contains_nul";

/**
 * The byte postgres cannot carry in a `text` bind parameter. Written as an
 * escape inside a regex rather than as a string literal so this source file
 * stays free of an ACTUAL NUL — one raw NUL makes the file binary to `grep`,
 * `git diff` and every review tool that reads it.
 */
const NUL_PATTERN = /\u0000/;

/**
 * The query-string contract.
 *
 * `q` is trimmed before the length check so a whitespace-only term fails as
 * "too short" rather than reaching `ILIKE '%   %'` and matching everything
 * with a space in its name. `String.prototype.trim` strips whitespace and
 * line terminators only — `U+0000` is neither, so it survives the trim and
 * needs the explicit check below.
 *
 * **Divergence from tRPC, deliberate and one-directional:** `course.
 * searchCourses` does NOT trim, so `" foo "` searches `'% foo %'` there and
 * `'%foo%'` here. Harmless (a leading-space term matches nothing useful) and
 * arguably better, but it is a real behavioural difference between two
 * surfaces that otherwise share one query — recorded here so nobody later
 * reads the shared service and concludes the two are byte-identical.
 * Tightening tRPC to match is an app-behaviour change riding on an API PR;
 * loosening `/v1` after ship is barred by §4. So they differ, on purpose.
 */
const courseQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .min(1, "q must not be empty")
    .max(MAX_QUERY_LENGTH, `q must be at most ${MAX_QUERY_LENGTH} characters`)
    .superRefine((value, ctx) => {
      if (NUL_PATTERN.test(value)) {
        ctx.addIssue({
          code: "custom",
          message: "q must not contain a NUL byte",
          params: { v1Code: NUL_IN_QUERY_FIELD_CODE },
        });
      }
    }),
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
 *
 * That guarantee is a property of THIS FUNCTION — of the `/v1` boundary — not
 * of the catalog module. `@/server/services/catalog` makes no such promise to
 * its other caller: `listCourseTees` returns `{ ...tee }`, a spread of the
 * whole `teeInfo` row, so a column added there DOES silently join the tRPC
 * response (see the note on `CatalogTee`). That is faithful pre-refactor
 * behaviour; it is stopped at `/v1` only because these serializers enumerate.
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
    // BUCKET 1 — pre-auth, keyed `ip:{ip}` (§3). This is the FIRST statement
    // on purpose: `authenticateV1Request` below is a NETWORK call to GoTrue
    // for every token that is merely well-FORMED, so limiting after it would
    // leave that round trip unmetered for callers holding no valid
    // credential at all. No principal argument, so `getIdentifier` falls
    // through to the IP key — the same call `GET /v1/health` makes. See the
    // header for the full reasoning and the NAT trade-off.
    const preAuth = await enforcePublicApiRateLimit(request, undefined, "reads");
    if (!preAuth.success) return rateLimitResponse(preAuth, { instance });

    const auth = await authenticateV1Request(request, { instance });
    if (!auth.ok) return problemResponse(auth.problem);

    // BUCKET 2 — per principal. Principal PARTS, never a composed key, and
    // the family is ALWAYS named: omitting it silently falls back to the
    // legacy 60/min shared bucket instead of the 120/min reads budget (see
    // `_lib/rate-limit-seam.ts`). Disjoint key space from bucket 1, so the
    // two never contend.
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
