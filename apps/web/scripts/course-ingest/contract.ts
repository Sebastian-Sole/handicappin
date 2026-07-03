/**
 * Ingestion contract — the "raw" course shape a scraper/extractor produces.
 *
 * This is intentionally LOOSER than the app's `courseSchema`: it mirrors what a
 * real scorecard actually shows (course-level par + stroke index, per-tee
 * distances), before any derivation. `normalize.ts` turns this into the strict
 * resolved `Course` shape that the app's own zod (`@/types/scorecard-input`)
 * validates. Keeping the raw shape close to the scorecard keeps the scraper's
 * job mechanical and auditable.
 *
 * For 9-hole courses, `pars` / stroke-index / per-tee `distances` carry 9
 * entries and are expanded to 18 during normalization (front nine repeated,
 * back-nine stroke index = front + 1), matching scripts/parse_scorecard.py.
 */
import { z } from "zod";

export const rawTeeSchema = z.object({
  /** Tee name as printed on the card, e.g. "White", "Yellow", "Championship". */
  name: z.string().min(1),
  /** One row per gender: GolfPass shows M and W ratings; emit two raw tees. */
  gender: z.enum(["mens", "ladies"]),
  courseRating18: z.number(),
  slopeRating18: z.number().int(),
  /** Real per-nine ratings if the source publishes them; otherwise omit and
   *  normalization will DERIVE them (and flag the course as fabricated). */
  courseRatingFront9: z.number().optional(),
  slopeRatingFront9: z.number().int().optional(),
  courseRatingBack9: z.number().optional(),
  slopeRatingBack9: z.number().int().optional(),
  /** 9 entries (9-hole) or 18 entries (18-hole). Per-hole distance for this tee. */
  distances: z.array(z.number().int().nonnegative()),
  /** Per-tee par override for tees that play a different par than the course
   *  default — common on UK ladies/forward tees (a men's par-4 plays par-5 for
   *  ladies, a long par-5 plays par-4 from the forward tee, etc.). 9 or 18
   *  entries; falls back to course-level `pars` when omitted. */
  pars: z.array(z.number().int()).optional(),
  /** Per-tee stroke-index override for when a tee's changed hole pars shift the
   *  allocation. 9 or 18 entries; falls back to the course-level (gender)
   *  stroke index when omitted. */
  strokeIndex: z.array(z.number().int()).optional(),
});

export const rawCourseSchema = z.object({
  name: z.string(),
  city: z.string(),
  country: z.string(),
  website: z.string().nullish(),
  isNineHole: z.boolean(),
  distanceMeasurement: z.enum(["meters", "yards"]),
  /** Course-level par per hole (shared across tees). 9 or 18 entries. */
  pars: z.array(z.number().int()),
  /** Men's stroke-index (hcp) allocation per hole. 9 or 18 entries. */
  strokeIndexMen: z.array(z.number().int()),
  /** Women's allocation if printed separately; falls back to men's. */
  strokeIndexWomen: z.array(z.number().int()).nullish(),
  tees: z.array(rawTeeSchema).min(1),
  /** Scraped data defaults to 'pending' — it must be reviewed before approval. */
  approvalStatus: z.enum(["pending", "approved"]).default("pending"),
  /** Provenance for the validator's cross-check and for audit. */
  source: z
    .object({ provider: z.string(), url: z.string().optional() })
    .optional(),
}).superRefine((c, ctx) => {
  // Every per-hole array must match the course's hole count (9 or 18). A
  // mismatched per-tee `pars`/`strokeIndex` would silently misalign holes, so
  // reject it at the contract boundary rather than emit corrupt SQL.
  const n = c.pars.length;
  const checkLen = (
    arr: number[] | null | undefined,
    path: (string | number)[],
    label: string,
  ) => {
    if (arr != null && arr.length !== n) {
      ctx.addIssue({
        code: "custom",
        message: `${label} must have ${n} entries to match 'pars' (got ${arr.length})`,
        path,
      });
    }
  };
  checkLen(c.strokeIndexMen, ["strokeIndexMen"], "strokeIndexMen");
  checkLen(c.strokeIndexWomen, ["strokeIndexWomen"], "strokeIndexWomen");
  c.tees.forEach((t, i) => {
    checkLen(t.distances, ["tees", i, "distances"], `tees.${i}.distances`);
    checkLen(t.pars, ["tees", i, "pars"], `tees.${i}.pars`);
    checkLen(t.strokeIndex, ["tees", i, "strokeIndex"], `tees.${i}.strokeIndex`);
  });
});

export type RawTee = z.infer<typeof rawTeeSchema>;
export type RawCourse = z.infer<typeof rawCourseSchema>;

/** Flags produced by normalization that the validator/report surfaces. */
export interface NormalizeMeta {
  /** front/back-9 ratings were derived (rating/2), not real — affects handicaps. */
  fabricatedNineRatings: boolean;
  /** a 9-hole card was expanded to 18 holes (front nine repeated). */
  nineHoleExpanded: boolean;
}
