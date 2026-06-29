/**
 * validate(): runs the *real* app contract (`courseSchema` from
 * @/types/scorecard-input) against a resolved course, then layers
 * scraping-specific sanity checks on top.
 *
 * Classification matters: the app's zod is calibrated for standard 18-hole
 * courses, but the existing seed legitimately contains par-3 / 9-hole courses
 * whose derived per-nine ratings fall below zod's min bounds. So pure
 * range violations are WARN (review, don't block); structural problems
 * (bad sums, stroke-index collisions, wrong types, missing holes) are ERROR.
 */
import { courseSchema } from "../../types/scorecard-input";
import type { Course } from "../../types/scorecard-input";
import type { NormalizeMeta } from "./contract";

export type Level = "error" | "warn" | "info";

export interface Finding {
  level: Level;
  code: string;
  message: string;
  path?: string;
}

export interface ValidateResult {
  ok: boolean; // no error-level findings
  findings: Finding[];
}

/** zod numeric range issues on these fields are advisory, not blocking. */
const RANGE_WARN_FIELDS = new Set([
  "courseRating18",
  "slopeRating18",
  "courseRatingFront9",
  "slopeRatingFront9",
  "courseRatingBack9",
  "slopeRatingBack9",
  "outPar",
  "inPar",
  "totalPar",
  "outDistance",
  "inDistance",
  "totalDistance",
  "par",
  "hcp",
  "distance",
  "holeNumber",
]);

function lastFieldSegment(path: PropertyKey[]): string {
  for (let i = path.length - 1; i >= 0; i--) {
    if (typeof path[i] === "string") return path[i] as string;
  }
  return "";
}

function classifyZodIssue(code: string, field: string): Level {
  if (code === "too_small" || code === "too_big") {
    return RANGE_WARN_FIELDS.has(field) ? "warn" : "error";
  }
  // custom (sum mismatch, duplicate hcp, duplicate tee), type/enum/url errors.
  return "error";
}

function isPermutation1to18(values: number[]): boolean {
  if (values.length !== 18) return false;
  const seen = new Set(values);
  if (seen.size !== 18) return false;
  for (let n = 1; n <= 18; n++) if (!seen.has(n)) return false;
  return true;
}

export function validate(
  resolved: Course,
  meta: NormalizeMeta,
  existingCourseNames: string[] = [],
): ValidateResult {
  const findings: Finding[] = [];

  // 1) The real app contract.
  const parsed = courseSchema.safeParse(resolved);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const field = lastFieldSegment(issue.path);
      findings.push({
        level: classifyZodIssue(issue.code, field),
        code: `zod:${issue.code}`,
        message: issue.message,
        path: issue.path.join("."),
      });
    }
  }

  const tees = resolved.tees ?? [];

  // 2) Structural sanity the app schema doesn't fully cover.
  tees.forEach((tee, ti) => {
    const where = `tees.${ti} (${tee.name}/${tee.gender})`;
    const holes = tee.holes ?? [];

    if (holes.length !== 18) {
      findings.push({
        level: "error",
        code: "holes:count",
        message: `${where}: expected 18 holes, got ${holes.length}`,
      });
      return;
    }

    const holeNumbers = holes.map((h) => h.holeNumber).sort((a, b) => a - b);
    const expected = Array.from({ length: 18 }, (_, i) => i + 1);
    if (holeNumbers.join(",") !== expected.join(",")) {
      findings.push({
        level: "error",
        code: "holes:numbering",
        message: `${where}: hole numbers must be exactly 1..18`,
      });
    }

    const hcps = holes.map((h) => h.hcp);
    if (!isPermutation1to18(hcps)) {
      findings.push({
        level: "error",
        code: "hcp:permutation",
        message: `${where}: stroke index must be a permutation of 1..18 (got [${hcps.join(", ")}])`,
      });
    }

    for (const h of holes) {
      if (h.par < 3 || h.par > 7) {
        findings.push({
          level: "error",
          code: "par:range",
          message: `${where}: hole ${h.holeNumber} par ${h.par} is implausible`,
        });
      } else if (h.par === 6 || h.par === 7) {
        findings.push({
          level: "warn",
          code: "par:unusual",
          message: `${where}: hole ${h.holeNumber} is a par ${h.par} (rare — verify)`,
        });
      }
    }
  });

  // 3) Cross-tee consistency: par/stroke-index geometry should match per hole.
  if (tees.length > 1) {
    const ref = tees[0].holes ?? [];
    for (let hn = 0; hn < 18; hn++) {
      const refPar = ref[hn]?.par;
      const parsDiffer = tees.some((t) => (t.holes ?? [])[hn]?.par !== refPar);
      if (parsDiffer) {
        findings.push({
          level: "warn",
          code: "xtee:par",
          message: `Hole ${hn + 1}: par differs across tees — verify the card`,
        });
      }
    }
    // Same-gender tees should share stroke index allocation.
    for (const g of ["mens", "ladies"] as const) {
      const gTees = tees.filter((t) => t.gender === g);
      if (gTees.length > 1) {
        const refHcp = (gTees[0].holes ?? []).map((h) => h.hcp).join(",");
        if (gTees.some((t) => (t.holes ?? []).map((h) => h.hcp).join(",") !== refHcp)) {
          findings.push({
            level: "warn",
            code: "xtee:hcp",
            message: `${g} tees disagree on stroke index allocation — verify`,
          });
        }
      }
    }
  }

  // 4) Unit plausibility (the silent handicap-corrupting bug class).
  const maxTotal = Math.max(...tees.map((t) => t.totalDistance ?? 0), 0);
  if (resolved.tees && maxTotal > 0) {
    if (resolved.tees[0].distanceMeasurement === "yards" && maxTotal < 4200) {
      findings.push({
        level: "warn",
        code: "unit:suspect-meters",
        message: `distanceMeasurement is 'yards' but the longest tee is only ${maxTotal} — these distances look metric. Double-check yards vs meters.`,
      });
    }
    if (resolved.tees[0].distanceMeasurement === "meters" && maxTotal > 6800) {
      findings.push({
        level: "warn",
        code: "unit:suspect-yards",
        message: `distanceMeasurement is 'meters' but the longest tee is ${maxTotal} — these distances look imperial. Double-check yards vs meters.`,
      });
    }
  }

  // 5) Fabricated per-nine ratings (carried over from GolfPass-style sources).
  if (meta.fabricatedNineRatings) {
    findings.push({
      level: "warn",
      code: "ratings:fabricated-nine",
      message:
        "front/back-9 ratings were DERIVED (course rating / 2), not sourced. They affect 9-hole handicap math — confirm against a real per-nine rating if possible.",
    });
  }

  // 6) Duplicate detection against the existing seed corpus.
  const norm = (s: string) => s.trim().toLowerCase();
  if (existingCourseNames.map(norm).includes(norm(resolved.name))) {
    findings.push({
      level: "warn",
      code: "dedup:name",
      message: `A course named "${resolved.name}" already exists in scripts/sql — confirm this isn't a duplicate (dedup key is name+country+city).`,
    });
  }

  return { ok: !findings.some((f) => f.level === "error"), findings };
}
