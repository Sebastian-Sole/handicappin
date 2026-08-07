/**
 * Catalog reads over `teeInfo` + `hole`. See `./index.ts` for what "catalog"
 * means and why this is shared rather than copied.
 *
 * Extracted verbatim from `tee.fetchTees`: the visibility union, the
 * `(courseId, name, gender)` deduplication, the single batched hole fetch and
 * the numeric coercions are all that procedure's logic, moved rather than
 * rewritten, so the tRPC surface keeps behaving exactly as it did.
 */
import { and, eq, inArray, or } from "drizzle-orm";

import { db } from "@/db";
import { hole, teeInfo } from "@/db/schema";

/** A hole as the catalog exposes it. */
export interface CatalogHole {
  id: number;
  teeId: number;
  holeNumber: number;
  par: number;
  distance: number;
  hcp: number;
}

/**
 * A tee as the catalog exposes it, holes attached and sorted by hole number.
 *
 * This is the shape `tee.fetchTees` has always returned — including the
 * moderation columns (`approvalStatus`, `isArchived`, `version`,
 * `submittedBy`, `parentTeeId`), which the web and native scorecards read.
 * `/v1` projects a narrower public shape from it; see
 * `app/api/v1/tees/route.ts`.
 *
 * ⚠️ **This interface is a floor, not a ceiling.** `listCourseTees` builds its
 * result with `{ ...tee }` — a spread of the full `teeInfo` row, extracted
 * verbatim from the procedure — so a column added to that table joins the
 * runtime object, and the tRPC response, WITHOUT appearing here and without a
 * type error (TypeScript checks excess properties on object literals, not on
 * spreads). That is faithful pre-refactor behaviour and not a regression, but
 * it means the "a new column cannot silently join the contract" guarantee is
 * `serializeTee`'s alone, at the `/v1` boundary — never this module's.
 */
export interface CatalogTee {
  id: number;
  courseId: number;
  name: string;
  gender: "mens" | "ladies";
  courseRating18: number;
  slopeRating18: number;
  courseRatingFront9: number;
  slopeRatingFront9: number;
  courseRatingBack9: number;
  slopeRatingBack9: number;
  outPar: number;
  inPar: number;
  totalPar: number;
  outDistance: number;
  inDistance: number;
  totalDistance: number;
  distanceMeasurement: "meters" | "yards";
  approvalStatus: "approved" | "pending";
  isArchived: boolean;
  version: number;
  submittedBy: string | null;
  parentTeeId: number | null;
  holes: CatalogHole[];
}

export interface ListCourseTeesOptions {
  courseId: number;
  /**
   * Widen visibility to also include this user's OWN pending tees.
   *
   * This is the single difference between the two callers. tRPC passes the
   * signed-in user id so a submitter can keep using a tee they submitted
   * while it waits for moderation; `/v1` passes nothing, so a connected app
   * sees the approved, non-archived catalog and only that.
   *
   * Named after the widening it performs rather than after the value it
   * takes, because a parameter called `userId` reads like scoping — the
   * opposite of what it does.
   */
  includePendingSubmittedBy?: string | null;
}

/**
 * THE catalog visibility predicate for `teeInfo`.
 *
 * Both conditions are load-bearing. An archived tee keeps
 * `approvalStatus = 'approved'` — archiving supersedes a tee, it does not
 * reject it — so dropping `isArchived = false` would leave every superseded
 * tee permanently resolvable, and a client would happily write rounds against
 * ratings the course no longer plays.
 */
function catalogVisible() {
  return and(
    eq(teeInfo.approvalStatus, "approved"),
    eq(teeInfo.isArchived, false)
  );
}

/**
 * Tees for one course, deduplicated, with holes.
 *
 * Deduplication by `(courseId, name, gender)`: when a pending EDIT of an
 * approved tee is visible, the pending version wins, and among several
 * pending edits the highest id wins. The sort puts approved first and then
 * ascending id, so the last write into the map is the winner. With no
 * `includePendingSubmittedBy` — the `/v1` case — nothing pending is ever in
 * the input, so the dedup is a no-op over an already-unique set (the partial
 * unique index `teeInfo_active_unique` guarantees it).
 */
export async function listCourseTees(
  options: ListCourseTeesOptions
): Promise<CatalogTee[]> {
  const { courseId, includePendingSubmittedBy } = options;

  const visibility = includePendingSubmittedBy
    ? or(
        catalogVisible(),
        and(
          eq(teeInfo.approvalStatus, "pending"),
          eq(teeInfo.submittedBy, includePendingSubmittedBy)
        )
      )
    : catalogVisible();

  const tees = await db
    .select()
    .from(teeInfo)
    .where(and(eq(teeInfo.courseId, courseId), visibility));

  const teesByCombo = new Map<string, (typeof tees)[number]>();
  const sorted = [...tees].sort((a, b) => {
    if (a.approvalStatus === "approved" && b.approvalStatus !== "approved")
      return -1;
    if (a.approvalStatus !== "approved" && b.approvalStatus === "approved")
      return 1;
    return a.id - b.id;
  });
  for (const tee of sorted) {
    teesByCombo.set(`${tee.courseId}_${tee.name}_${tee.gender}`, tee);
  }
  const deduplicatedTees = Array.from(teesByCombo.values());

  // One batched hole fetch for every surviving tee, never one per tee.
  const teeIds = deduplicatedTees.map((tee) => tee.id);
  const allHoles =
    teeIds.length > 0
      ? await db.select().from(hole).where(inArray(hole.teeId, teeIds))
      : [];

  const holesByTeeId = new Map<number, CatalogHole[]>();
  for (const h of allHoles) {
    const existing = holesByTeeId.get(h.teeId) ?? [];
    existing.push(h);
    holesByTeeId.set(h.teeId, existing);
  }

  return deduplicatedTees.map((tee) => ({
    ...tee,
    // `decimal` columns arrive as strings from postgres.
    courseRating18: Number(tee.courseRating18),
    courseRatingFront9: Number(tee.courseRatingFront9),
    courseRatingBack9: Number(tee.courseRatingBack9),
    approvalStatus: tee.approvalStatus as "approved" | "pending",
    distanceMeasurement: tee.distanceMeasurement as "meters" | "yards",
    gender: tee.gender as "mens" | "ladies",
    holes: (holesByTeeId.get(tee.id) ?? []).sort(
      (a, b) => a.holeNumber - b.holeNumber
    ),
  }));
}
