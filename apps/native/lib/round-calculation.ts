/**
 * Round-calculation state — native port of apps/web/contexts/
 * roundCalculationContext.tsx as a hook. ALL math comes from
 * @handicappin/handicap-core (single source; never reimplemented).
 */
import { useMemo, useState } from "react";

import {
  calculate9HoleScoreDifferential,
  calculateAdjustedGrossScore,
  calculateAdjustedPlayedScore,
  calculateExpected9HoleDifferential,
  calculateScoreDifferential,
} from "@handicappin/handicap-core";
import type { Hole, Score } from "@handicappin/handicap-core";

import type { ScorecardWithRound } from "@/lib/api/schemas/scorecard";

export interface RoundCalculation {
  scorecard: ScorecardWithRound;
  holes: Hole[];
  par: number;
  setPar: (par: number) => void;
  handicapIndex: number;
  setHandicapIndex: (index: number) => void;
  slope: number;
  setSlope: (slope: number) => void;
  rating: number;
  setRating: (rating: number) => void;
  isNineHoles: boolean;
  setIsNineHoles: (isNineHoles: boolean) => void;
  setHolesPlayed: (holesPlayed: number) => void;
  adjustedPlayedScore: number;
  courseHandicapCalculation: number;
  adjustedGrossScoreCalculation: number;
  scoreDifferentialCalculation: number;
  playedDifferential: number;
  expectedDifferential: number;
  apsStat: number;
  hasEstablishedHandicap: boolean;
  nineHoleSection: "front" | "back";
  originals: {
    handicapIndex: number;
    slope: number;
    rating: number;
    par: number;
  };
}

export function useRoundCalculation(
  scorecard: ScorecardWithRound,
): RoundCalculation {
  const holes = (scorecard.teePlayed.holes ?? []) as Hole[];
  const scores = scorecard.scores as Score[];

  const actualHolesPlayed = scores.length;
  const isNineHoleRound = actualHolesPlayed === 9;
  const nineHoleSection: "front" | "back" =
    (scorecard as { nineHoleSection?: "front" | "back" }).nineHoleSection ??
    "front";
  const isBackNine = isNineHoleRound && nineHoleSection === "back";

  const tee = scorecard.teePlayed;
  const initialNinePar = isBackNine ? tee.inPar : tee.outPar;
  const initialNineSlope = isBackNine
    ? tee.slopeRatingBack9
    : tee.slopeRatingFront9;
  const initialNineRating = isBackNine
    ? tee.courseRatingBack9
    : tee.courseRatingFront9;

  const [par, setPar] = useState(
    isNineHoleRound ? initialNinePar : tee.totalPar,
  );
  const [holesPlayed, setHolesPlayed] = useState(actualHolesPlayed);
  const [handicapIndex, setHandicapIndex] = useState(
    scorecard.round.existingHandicapIndex,
  );
  const [isNineHoles, setIsNineHoles] = useState(isNineHoleRound);
  const [slope, setSlope] = useState(
    isNineHoleRound ? initialNineSlope : tee.slopeRating18,
  );
  const [rating, setRating] = useState(
    isNineHoleRound ? initialNineRating : tee.courseRating18,
  );

  const hasEstablishedHandicap = (scorecard.roundsBeforeTeeTime ?? 0) >= 3;

  const [adjustedPlayedScore] = useState(() =>
    calculateAdjustedPlayedScore(holes, scores, hasEstablishedHandicap),
  );

  const courseHandicapCalculation = useMemo(() => {
    if (isNineHoles) {
      return Math.round((handicapIndex / 2) * (slope / 113) + (rating - par));
    }
    return Math.round(handicapIndex * (slope / 113) + (rating - par));
  }, [handicapIndex, slope, rating, par, isNineHoles]);

  const adjustedGrossScoreCalculation = useMemo(() => {
    return calculateAdjustedGrossScore(
      adjustedPlayedScore,
      courseHandicapCalculation,
      holesPlayed,
      holes,
      scores,
    );
  }, [
    adjustedPlayedScore,
    courseHandicapCalculation,
    holesPlayed,
    holes,
    scores,
  ]);

  const expectedDifferential = useMemo(() => {
    if (!isNineHoles) return 0;
    return calculateExpected9HoleDifferential(
      handicapIndex,
      rating,
      slope,
      par,
    );
  }, [isNineHoles, handicapIndex, rating, slope, par]);

  const playedDifferential = useMemo(() => {
    if (!isNineHoles) return 0;
    return ((adjustedPlayedScore - rating) * 113) / slope;
  }, [isNineHoles, adjustedPlayedScore, rating, slope]);

  const scoreDifferentialCalculation = useMemo(() => {
    if (isNineHoles) {
      return calculate9HoleScoreDifferential(
        adjustedPlayedScore,
        rating,
        slope,
        expectedDifferential,
      );
    }
    return calculateScoreDifferential(
      adjustedGrossScoreCalculation,
      rating,
      slope,
    );
  }, [
    adjustedGrossScoreCalculation,
    adjustedPlayedScore,
    rating,
    slope,
    isNineHoles,
    expectedDifferential,
  ]);

  const apsStat = calculateAdjustedPlayedScore(
    holes,
    scores,
    hasEstablishedHandicap,
  );
  return {
    scorecard,
    holes,
    par,
    setPar,
    handicapIndex,
    setHandicapIndex,
    slope,
    setSlope,
    rating,
    setRating,
    isNineHoles,
    setIsNineHoles,
    setHolesPlayed,
    adjustedPlayedScore,
    courseHandicapCalculation,
    adjustedGrossScoreCalculation,
    scoreDifferentialCalculation,
    playedDifferential,
    expectedDifferential,
    apsStat,
    hasEstablishedHandicap,
    nineHoleSection,
    originals: {
      handicapIndex: scorecard.round.existingHandicapIndex,
      slope: isNineHoleRound ? initialNineSlope : tee.slopeRating18,
      rating: isNineHoleRound ? initialNineRating : tee.courseRating18,
      par: isNineHoleRound ? initialNinePar : tee.totalPar,
    },
  };
}
