/**
 * `GET /v1/tees` — the playable tees of one catalog course.
 *
 * The second half of the resolve: `GET /v1/courses` gives a `courseId`, this
 * turns it into the `teeId` a round write references.
 *
 * ── Query parameters (FROZEN AT SHIP — §4) ────────────────────────────────
 * Undecided in the contract (`007-w6-fitbull-integration-notes.md` §10 item
 * 2) and frozen here. §4 makes post-ship narrowing breaking, so the set is
 * the smallest one that serves the resolve:
 *
 *   `courseId`  REQUIRED, positive integer.
 *
 * Deliberately absent: `teeId` (a client that already holds a `teeId` can
 * re-read the course's tees and find it; adding the parameter later is
 * additive), `gender`, `holes`, and any pagination — a course has a handful
 * of tees, so a page cursor would be ceremony we could never remove.
 *
 * ── Response shape (FROZEN AT SHIP) ───────────────────────────────────────
 *   200 `{ "tees": [ { id, courseId, name, gender, distanceMeasurement,
 *                      courseRating18, slopeRating18,
 *                      courseRatingFront9, slopeRatingFront9,
 *                      courseRatingBack9, slopeRatingBack9,
 *                      outPar, inPar, totalPar,
 *                      outDistance, inDistance, totalDistance,
 *                      holes: [ { holeNumber, par, hcp, distance } ] } ] }`
 *
 * Object wrapper for the same reason as `/v1/courses`: an array can never
 * gain a sibling field. Ratings are numbers, not the strings postgres returns
 * for `decimal` — the shared catalog service does that coercion once for both
 * surfaces. Nine-hole ratings are included because a 9-hole round is written
 * against the front-or-back rating, not the 18-hole one.
 *
 * **Moderation columns are not exposed**: `approvalStatus` and `isArchived`
 * are constants here by construction, and `submittedBy` is another user's id
 * — publishing it would leak who submitted a course to every connected app.
 * `version` and `parentTeeId` are internal edit-lineage. The catalog service
 * returns all five because the app surfaces read them; `serializeTee` is the
 * boundary that stops them at `/v1`.
 *
 * Hole `id` and `teeId` are dropped too: within a tee, `holeNumber` already
 * identifies a hole, and a bare row id is not a stable thing to promise.
 *
 * ── The catalog miss ──────────────────────────────────────────────────────
 * A `courseId` that is not in the catalog → **422 `course_not_found`**
 * (contract §1), NOT a 404 and NOT an empty list:
 *
 *   - not 404, because §1 assigns `course_not_found` 422 and the client's
 *     remedy is to re-resolve the course, not to conclude the endpoint is
 *     wrong;
 *   - not an empty list, because "this course has no approved tees yet" and
 *     "there is no such course" call for different client behaviour, and an
 *     empty list would leave a client retrying a courseId that will never
 *     resolve.
 *
 * A course that exists but is NOT approved is indistinguishable from one that
 * does not exist — both are 422 `course_not_found`. That is the same refusal
 * to build an existence oracle §1 states for `not_found`, applied here: the
 * catalog is a public, approved-only view, and whether some user has a
 * pending submission is not a connected app's business.
 *
 * ── What this route does NOT do ───────────────────────────────────────────
 * No entitlement check and no scope check, for the reasons written out in
 * `../courses/route.ts`. Handler responsibilities are authenticate,
 * rate-limit, validate, call the shared service, serialize, map errors; the
 * queries live in `@/server/services/catalog`, shared with tRPC.
 */
import { z } from "zod";

import {
  authenticateV1Request,
  createProblem,
  errorResponse,
  jsonResponse,
  problemResponse,
  rateLimitResponse,
  v1RateLimitPrincipal,
  validationProblem,
} from "@/app/api/v1/_lib";
import { enforcePublicApiRateLimit } from "@/lib/rate-limit";
import {
  findCatalogCourse,
  listCourseTees,
  type CatalogTee,
} from "@/server/services/catalog";

const ROUTE = "GET /v1/tees";

/**
 * `courseId` is a `serial` primary key, so it is a positive 32-bit integer.
 * Bounding it here keeps an absurd value out of the query rather than letting
 * postgres reject it as an out-of-range integer and surface a 500.
 */
const PG_MAX_INT = 2147483647;

const teeQuerySchema = z.object({
  courseId: z.coerce
    .number()
    .int("courseId must be an integer")
    .min(1, "courseId must be a positive integer")
    .max(PG_MAX_INT, "courseId is out of range"),
});

/**
 * The wire shape. Explicit field-by-field rather than a spread — the catalog
 * type carries moderation columns that must not cross this boundary, and a
 * spread would publish any column added to `teeInfo` later.
 */
function serializeTee(tee: CatalogTee) {
  return {
    id: tee.id,
    courseId: tee.courseId,
    name: tee.name,
    gender: tee.gender,
    distanceMeasurement: tee.distanceMeasurement,
    courseRating18: tee.courseRating18,
    slopeRating18: tee.slopeRating18,
    courseRatingFront9: tee.courseRatingFront9,
    slopeRatingFront9: tee.slopeRatingFront9,
    courseRatingBack9: tee.courseRatingBack9,
    slopeRatingBack9: tee.slopeRatingBack9,
    outPar: tee.outPar,
    inPar: tee.inPar,
    totalPar: tee.totalPar,
    outDistance: tee.outDistance,
    inDistance: tee.inDistance,
    totalDistance: tee.totalDistance,
    holes: tee.holes.map((hole) => ({
      holeNumber: hole.holeNumber,
      par: hole.par,
      hcp: hole.hcp,
      distance: hole.distance,
    })),
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
    const parsed = teeQuerySchema.safeParse({
      courseId: url.searchParams.get("courseId") ?? undefined,
    });
    if (!parsed.success) {
      return problemResponse(validationProblem(parsed.error, { instance }));
    }

    // The catalog miss is decided BEFORE the tee read, so "no such course"
    // and "no approved tees yet" stay distinguishable to the client.
    const course = await findCatalogCourse(parsed.data.courseId);
    if (!course) {
      return problemResponse(
        createProblem({ code: "course_not_found", instance })
      );
    }

    const tees = await listCourseTees({ courseId: course.id });

    return jsonResponse({ tees: tees.map(serializeTee) }, 200);
  } catch (error) {
    return errorResponse(error, {
      instance,
      route: ROUTE,
    });
  }
}
