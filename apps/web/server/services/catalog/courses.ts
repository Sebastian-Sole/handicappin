/**
 * Catalog reads over `course`. See `./index.ts` for what "catalog" means and
 * why this is shared rather than copied.
 */
import { and, eq, ilike } from "drizzle-orm";

import { db } from "@/db";
import { course } from "@/db/schema";

/**
 * A course as the catalog exposes it.
 *
 * `approvalStatus` is deliberately absent: every row this module returns is
 * approved by construction, so carrying the column would only invite a caller
 * to branch on a constant. Callers that must echo it (tRPC does, for its
 * existing client contract) restate the literal themselves.
 */
export interface CatalogCourse {
  id: number;
  name: string;
  country: string;
  city: string;
  /** `null` when the course has no website on file. */
  website: string | null;
}

/** The projection both callers read. Kept in one place so it cannot drift. */
const COURSE_COLUMNS = {
  id: course.id,
  name: course.name,
  country: course.country,
  city: course.city,
  website: course.website,
} as const;

/**
 * THE catalog visibility predicate for `course`.
 *
 * `course` has no `isArchived` column — approval is the whole filter. If one
 * is ever added, this is the single line that has to learn about it, and both
 * surfaces pick the change up at once.
 */
function catalogVisible() {
  return eq(course.approvalStatus, "approved");
}

/** Default page size — the cap `course.searchCourses` has always applied. */
export const DEFAULT_COURSE_SEARCH_LIMIT = 10;

/**
 * Courses whose name contains `query`, case-insensitively.
 *
 * The pattern is `%query%` on `ILIKE`, exactly as the tRPC procedure has
 * always matched. `query` is interpolated into a bound parameter by Drizzle,
 * so it is not an injection vector — but `%` and `_` inside it ARE still
 * wildcards, which is a documented property of the search rather than a bug:
 * both surfaces have the same semantics, and neither promises literal
 * matching.
 *
 * **The one place the two surfaces differ:** `/v1/courses` TRIMS `q` before
 * calling this, and `course.searchCourses` does not — so `" foo "` searches
 * `'%foo%'` on `/v1` and `'% foo %'` on tRPC. Harmless, arguably better on
 * `/v1`, and left as-is deliberately (tightening tRPC would change app
 * behaviour on an API PR; loosening `/v1` after ship is barred by contract
 * §4). Recorded because the whole point of this module is that the two
 * surfaces answer identically, so the exception should not have to be
 * rediscovered.
 *
 * A `query` containing a NUL byte (`U+0000`) makes postgres reject the bind
 * parameter with SQLSTATE `22021`; `/v1/courses` rejects it as a 422 before
 * it gets here, and tRPC still surfaces the error (pre-existing, unchanged).
 */
export async function searchCatalogCourses(options: {
  query: string;
  limit?: number;
}): Promise<CatalogCourse[]> {
  const limit = options.limit ?? DEFAULT_COURSE_SEARCH_LIMIT;
  return db
    .select(COURSE_COLUMNS)
    .from(course)
    .where(and(ilike(course.name, `%${options.query}%`), catalogVisible()))
    .limit(limit);
}

/**
 * One catalog course by id, or `null` when it is not in the catalog.
 *
 * `null` covers BOTH "no such row" and "the row exists but is not approved".
 * The two are deliberately indistinguishable to a caller — telling them apart
 * would turn this into an oracle for unapproved, user-submitted course
 * submissions (contract §1's `not_found` reasoning applied one table over).
 */
export async function findCatalogCourse(
  courseId: number
): Promise<CatalogCourse | null> {
  const rows = await db
    .select(COURSE_COLUMNS)
    .from(course)
    .where(and(eq(course.id, courseId), catalogVisible()))
    .limit(1);
  return rows[0] ?? null;
}
