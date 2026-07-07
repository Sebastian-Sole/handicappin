/** Shared fixtures for round-session tests (not a test file itself). */
import type { Hole, Tee } from "@handicappin/handicap-core";

import type { SessionCourse } from "../../lib/round-session/types";

export const T0 = "2026-07-06T09:00:00.000Z";

const hole = (holeNumber: number, hcp: number, par = 4): Hole => ({
  id: holeNumber,
  teeId: 42,
  holeNumber,
  par,
  hcp,
  distance: 350,
});

/** 18 holes, all par 4, stroke indexes 1–18 in a scrambled but unique order. */
export const makeHoles = (): Hole[] =>
  Array.from({ length: 18 }, (_, i) => hole(i + 1, ((i * 7) % 18) + 1));

export const makeTee = (): Tee => ({
  id: 42,
  courseId: 7,
  name: "White",
  gender: "mens",
  courseRating18: 72.1,
  slopeRating18: 128,
  courseRatingFront9: 36,
  slopeRatingFront9: 126,
  courseRatingBack9: 36.1,
  slopeRatingBack9: 130,
  outPar: 36,
  inPar: 36,
  totalPar: 72,
  outDistance: 3100,
  inDistance: 3150,
  totalDistance: 6250,
  distanceMeasurement: "meters",
  approvalStatus: "approved",
  holes: makeHoles(),
});

export const makeSessionCourse = (): SessionCourse => ({
  id: 7,
  name: "Test Links",
  city: "St. Andrews",
  country: "Scotland",
  website: "",
  approvalStatus: "approved",
});
