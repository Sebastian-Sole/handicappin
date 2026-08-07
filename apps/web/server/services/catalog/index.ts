/**
 * The course/tee **catalog** — the single implementation of the reads that
 * resolve a course name to a `courseId` and a `courseId` to a `teeId`.
 *
 * ── Why this module exists ────────────────────────────────────────────────
 * Two surfaces need the same answer: tRPC (`course.searchCourses`,
 * `tee.fetchTees`) for the web and native apps, and `/api/v1`
 * (`GET /v1/courses`, `GET /v1/tees`) for connected apps. A second copy of a
 * catalog query drifts, and the drift is invisible until the same course
 * resolves differently on the two surfaces — a round written against the tee
 * `/v1` chose but displayed against the tee tRPC chose. So the query lives
 * here once and both callers project from it.
 *
 * ── Catalog visibility is the thing this module is careful about ──────────
 * "In the catalog" means **approved and not archived**, and nothing else:
 *
 *   - `course.approvalStatus = 'approved'` — the `course` table has no
 *     archive flag, so approval is the whole filter.
 *   - `teeInfo.approvalStatus = 'approved' AND teeInfo.isArchived = false` —
 *     both, because an archived tee stays `approved` (it is superseded, not
 *     rejected) and would otherwise remain resolvable forever.
 *
 * `listCourseTees` takes one option, `includePendingSubmittedBy`, and that
 * option is the ENTIRE difference between the two callers: tRPC's
 * `fetchTees` passes the signed-in user so a submitter can see their own
 * pending tee while it waits for moderation; `/v1` passes nothing, so the
 * catalog it serves is strictly the approved, non-archived one. Passing a
 * user id here is a deliberate widening of visibility — it is why the option
 * is named after what it does rather than something like `userId`.
 *
 * ── What this module is NOT ───────────────────────────────────────────────
 * Not a general course repository. It answers "what may a client resolve
 * against?", so it deliberately has no write path, no moderation read (the
 * admin console reads `db` directly), and no by-id read that ignores
 * approval — `course.getCourseById` still serves the app's own course pages,
 * which legitimately show a pending course to the user who submitted it.
 * Adding an "ignore approval" flag here would put the catalog boundary one
 * boolean away from being bypassed by a caller that did not mean to.
 *
 * Reads go through Drizzle's pooled `db` client, matching the procedures this
 * was extracted from. That client is not RLS-scoped, which is why every
 * exported function applies the visibility filter itself rather than relying
 * on a policy to do it.
 */

export {
  DEFAULT_COURSE_SEARCH_LIMIT,
  findCatalogCourse,
  searchCatalogCourses,
  type CatalogCourse,
} from "./courses";

export {
  listCourseTees,
  type CatalogHole,
  type CatalogTee,
  type ListCourseTeesOptions,
} from "./tees";
