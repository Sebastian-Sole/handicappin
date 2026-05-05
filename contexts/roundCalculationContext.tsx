import React, {
  createContext,
  useContext,
  useMemo,
  useState,
  ReactNode,
} from "react";
import {
  calculateAdjustedPlayedScore,
  calculateCourseHandicap,
  calculateAdjustedGrossScore,
  calculateScoreDifferential,
  calculate9HoleScoreDifferential,
  calculateExpected9HoleDifferential,
} from "@handicappin/handicap-core";
import { ScorecardWithRound } from "@/types/scorecard-input";

interface RoundCalculationContextProps {
  scorecard: ScorecardWithRound;
  par: number;
  setPar: (par: number) => void;
  numberOfHolesPlayed: number;
  setHolesPlayed: (holesPlayed: number) => void;
  handicapIndex: number;
  setHandicapIndex: (index: number) => void;
  slope: number;
  setSlope: (slope: number) => void;
  rating: number;
  setRating: (rating: number) => void;
  isNineHoles: boolean;
  setIsNineHoles: (isNineHoles: boolean) => void;
  adjustedPlayedScore: number;
  setAdjustedPlayedScore: (score: number) => void;
  courseHandicapCalculation: number;
  adjustedGrossScoreCalculation: number;
  scoreDifferentialCalculation: number;
  // 9-hole specific values for displaying calculation breakdown
  playedDifferential: number;
  expectedDifferential: number;
  courseHcpStat: number;
  apsStat: number;
  hasEstablishedHandicap: boolean;
}

const RoundCalculationContext = createContext<
  RoundCalculationContextProps | undefined
>(undefined);

export const RoundCalculationProvider = ({
  children,
  scorecard,
}: {
  children: ReactNode;
  scorecard: ScorecardWithRound;
}) => {
  const holes = scorecard.teePlayed.holes
  if (!holes) {
    throw new Error("Holes are undefined");
  }

  // Determine if 9-hole round based on actual scores submitted
  const actualHolesPlayed = scorecard.scores.length;
  const isNineHoleRound = actualHolesPlayed === 9;
  // Section is on the scorecard for new submissions; legacy rows fall back to "front".
  const nineHoleSection: "front" | "back" = scorecard.nineHoleSection ?? "front";
  const isBackNine = isNineHoleRound && nineHoleSection === "back";

  const initialNinePar = isBackNine
    ? scorecard.teePlayed.inPar
    : scorecard.teePlayed.outPar;
  const initialNineSlope = isBackNine
    ? scorecard.teePlayed.slopeRatingBack9
    : scorecard.teePlayed.slopeRatingFront9;
  const initialNineRating = isBackNine
    ? scorecard.teePlayed.courseRatingBack9
    : scorecard.teePlayed.courseRatingFront9;

  const [par, setPar] = useState(isNineHoleRound ? initialNinePar : scorecard.teePlayed.totalPar);
  const [holesPlayed, setHolesPlayed] = useState(actualHolesPlayed);
  const [handicapIndex, setHandicapIndex] = useState(
    scorecard.round.existingHandicapIndex
  );

  const [isNineHoles, setIsNineHoles] = useState(isNineHoleRound);
  const [slope, setSlope] = useState(isNineHoleRound ? initialNineSlope : scorecard.teePlayed.slopeRating18);
  const [rating, setRating] = useState(isNineHoleRound ? initialNineRating : scorecard.teePlayed.courseRating18);
  // Determine if player has an established handicap (USGA requires 3+ rounds)
  // Use the count of rounds played before this round's tee time
  const hasEstablishedHandicap = (scorecard.roundsBeforeTeeTime ?? 0) >= 3;

  const [adjustedPlayedScore, setAdjustedPlayedScore] = useState(
    calculateAdjustedPlayedScore(holes, scorecard.scores, hasEstablishedHandicap)
  );

  const courseHandicapCalculation = useMemo(() => {
    if (isNineHoles) {
      // For 9-hole rounds: divide handicap index by 2, but keep (rating - par) at full value
      // per USGA rules - we're already using 9-hole rating/par values
      return Math.round((handicapIndex / 2) * (slope / 113) + (rating - par));
    } else {
      return Math.round(handicapIndex * (slope / 113) + (rating - par));
    }
  }, [handicapIndex, slope, rating, par, isNineHoles]);

  const adjustedGrossScoreCalculation = useMemo(() => {
    return calculateAdjustedGrossScore(
      adjustedPlayedScore,
      courseHandicapCalculation,
      holesPlayed,
      scorecard.teePlayed.holes || [],
      scorecard.scores
    );
  }, [
    adjustedPlayedScore,
    courseHandicapCalculation,
    holesPlayed,
    scorecard.teePlayed.holes,
    scorecard.scores
  ]);

  // Calculate expected differential for 9-hole rounds (for display breakdown)
  // Uses editable rating/slope values so users can override if needed
  const expectedDifferentialCalc = useMemo(() => {
    if (!isNineHoles) return 0;
    return calculateExpected9HoleDifferential(
      handicapIndex,
      rating,
      slope,
      par
    );
  }, [isNineHoles, handicapIndex, rating, slope, par]);

  // Calculate played differential for 9-hole rounds (for display breakdown)
  // Uses editable rating/slope values for consistency
  const playedDifferentialCalc = useMemo(() => {
    if (!isNineHoles) return 0;
    return (adjustedPlayedScore - rating) * (113 / slope);
  }, [isNineHoles, adjustedPlayedScore, rating, slope]);

  const scoreDifferentialCalculation = useMemo(() => {
    if (isNineHoles) {
      // For 9-hole rounds, calculate 18-hole equivalent using USGA Rule 5.1b
      // Uses editable rating/slope values for consistency with 18-hole behavior
      return calculate9HoleScoreDifferential(
        adjustedPlayedScore,
        rating,
        slope,
        expectedDifferentialCalc
      );
    }

    return calculateScoreDifferential(
      adjustedGrossScoreCalculation,
      rating,
      slope
    );
  }, [adjustedGrossScoreCalculation, adjustedPlayedScore, rating, slope, isNineHoles, expectedDifferentialCalc]);

  const courseHcpStat = calculateCourseHandicap(
    handicapIndex,
    scorecard.teePlayed,
    holesPlayed,
    nineHoleSection
  );

  const apsStat = calculateAdjustedPlayedScore(holes, scorecard.scores, hasEstablishedHandicap);

  return (
    <RoundCalculationContext.Provider
      value={{
        scorecard,
        par,
        setPar,
        numberOfHolesPlayed: holesPlayed,
        setHolesPlayed,
        handicapIndex,
        setHandicapIndex,
        slope,
        setSlope,
        rating,
        setRating,
        isNineHoles,
        setIsNineHoles,
        adjustedPlayedScore,
        setAdjustedPlayedScore,
        courseHandicapCalculation,
        adjustedGrossScoreCalculation,
        scoreDifferentialCalculation,
        playedDifferential: playedDifferentialCalc,
        expectedDifferential: expectedDifferentialCalc,
        courseHcpStat,
        apsStat,
        hasEstablishedHandicap,
      }}
    >
      {children}
    </RoundCalculationContext.Provider>
  );
};

export const useRoundCalculationContext = () => {
  const context = useContext(RoundCalculationContext);
  if (context === undefined) {
    throw new Error(
      "useRoundCalculation must be used within a RoundCalculationProvider"
    );
  }
  return context;
};
