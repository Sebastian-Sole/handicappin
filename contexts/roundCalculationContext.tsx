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
} from "@/lib/handicap";
import { ScorecardWithRound } from "@/types/scorecard";

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
  const [par, setPar] = useState(scorecard.teePlayed.totalPar);
  const [holesPlayed, setHolesPlayed] = useState(holes.length);
  const [handicapIndex, setHandicapIndex] = useState(
    scorecard.round.existingHandicapIndex
  );

  const [isNineHoles, setIsNineHoles] = useState(holesPlayed === 9);
  const [slope, setSlope] = useState(isNineHoles ? scorecard.teePlayed.slopeRatingFront9 : scorecard.teePlayed.slopeRating18);
  const [rating, setRating] = useState(isNineHoles ? scorecard.teePlayed.courseRatingFront9 : scorecard.teePlayed.courseRating18);
  // Determine if player has an established handicap (USGA requires 3+ rounds)
  // Use the count of rounds played before this round's tee time
  const hasEstablishedHandicap = (scorecard.roundsBeforeTeeTime ?? 0) >= 3;

  const [adjustedPlayedScore, setAdjustedPlayedScore] = useState(
    calculateAdjustedPlayedScore(holes, scorecard.scores, hasEstablishedHandicap)
  );

  const courseHandicapCalculation = useMemo(() => {
    if (isNineHoles) {
      return (handicapIndex / 2) * (slope / 113) + (rating - par) / 2;
    } else {
      return handicapIndex * (slope / 113) + (rating - par);
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

  const scoreDifferentialCalculation = useMemo(() => {
    return calculateScoreDifferential(
      adjustedGrossScoreCalculation,
      rating,
      slope
    );
  }, [adjustedGrossScoreCalculation, rating, slope]);

  const courseHcpStat = calculateCourseHandicap(
    handicapIndex,
    scorecard.teePlayed,
    holesPlayed
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
