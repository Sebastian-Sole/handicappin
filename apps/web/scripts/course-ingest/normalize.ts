/**
 * normalize(): raw scorecard shape -> strict resolved `Course` (app courseSchema
 * shape), with all derived fields computed exactly the way
 * scripts/parse_scorecard.py does, so output is consistent with the existing
 * 51 seed files.
 */
import type { Course, Hole, Tee } from "../../types/scorecard-input";
import type { NormalizeMeta, RawCourse, RawTee } from "./contract";

/** 9-hole stroke index -> 18: front nine as-is, back nine = front + 1. */
function expandNineHoleStrokeIndex(nine: number[]): number[] {
  return [...nine, ...nine.map((h) => h + 1)];
}

/** Repeat a 9-entry array to 18 (front nine played twice). */
function expandNine<T>(nine: T[]): T[] {
  return [...nine, ...nine];
}

function sum(ns: number[]): number {
  return ns.reduce((a, b) => a + b, 0);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function normalize(raw: RawCourse): { resolved: Course; meta: NormalizeMeta } {
  const nine = raw.isNineHole;

  // Course-level par + stroke index, expanded to 18 if needed.
  const pars18 = nine ? expandNine(raw.pars) : raw.pars;
  const siMen18 = nine
    ? expandNineHoleStrokeIndex(raw.strokeIndexMen)
    : raw.strokeIndexMen;
  const siWomenSource = raw.strokeIndexWomen ?? raw.strokeIndexMen;
  const siWomen18 = nine
    ? expandNineHoleStrokeIndex(siWomenSource)
    : siWomenSource;

  let fabricatedNineRatings = false;

  const tees: Tee[] = raw.tees.map((rt: RawTee): Tee => {
    const distances18 = nine ? expandNine(rt.distances) : rt.distances;
    const strokeIndex = rt.gender === "ladies" ? siWomen18 : siMen18;

    const holes: Hole[] = distances18.map((distance, i) => ({
      holeNumber: i + 1,
      par: pars18[i],
      distance,
      hcp: strokeIndex[i],
    }));

    const outPar = sum(pars18.slice(0, 9));
    const inPar = sum(pars18.slice(9, 18));
    const outDistance = sum(distances18.slice(0, 9));
    const inDistance = sum(distances18.slice(9, 18));

    // Per-nine ratings: use real values if the source supplied them, else
    // DERIVE (rating/2, slope unchanged) and flag — same fallback as the
    // Python parser, because GolfPass et al. don't publish per-nine ratings.
    const hasRealNine =
      rt.courseRatingFront9 != null &&
      rt.slopeRatingFront9 != null &&
      rt.courseRatingBack9 != null &&
      rt.slopeRatingBack9 != null;

    let crFront: number;
    let crBack: number;
    let slFront: number;
    let slBack: number;
    if (hasRealNine) {
      crFront = rt.courseRatingFront9!;
      crBack = rt.courseRatingBack9!;
      slFront = rt.slopeRatingFront9!;
      slBack = rt.slopeRatingBack9!;
    } else {
      fabricatedNineRatings = true;
      crFront = round1(rt.courseRating18 / 2);
      crBack = crFront;
      slFront = rt.slopeRating18;
      slBack = rt.slopeRating18;
    }

    return {
      name: rt.name,
      gender: rt.gender,
      courseRating18: rt.courseRating18,
      slopeRating18: rt.slopeRating18,
      courseRatingFront9: crFront,
      slopeRatingFront9: slFront,
      courseRatingBack9: crBack,
      slopeRatingBack9: slBack,
      outPar,
      inPar,
      totalPar: outPar + inPar,
      outDistance,
      inDistance,
      totalDistance: outDistance + inDistance,
      distanceMeasurement: raw.distanceMeasurement,
      approvalStatus: raw.approvalStatus,
      holes,
    };
  });

  const resolved: Course = {
    name: raw.name,
    approvalStatus: raw.approvalStatus,
    country: raw.country,
    city: raw.city,
    website: raw.website ?? undefined,
    tees,
  };

  return {
    resolved,
    meta: { fabricatedNineRatings, nineHoleExpanded: nine },
  };
}
