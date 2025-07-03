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
  calculateScoreDifferential,
} from "@/utils/calculations/handicap";
import { RoundWithCourseAndTee } from "@/types/database";
import { Tables } from "@/types/supabase";

interface RoundCalculationContextProps {
  round: RoundWithCourseAndTee;
  holes: Tables<"hole">[];
  par: number;
  setPar: (par: number) => void;
  holesPlayed: number;
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
}

const RoundCalculationContext = createContext<
  RoundCalculationContextProps | undefined
>(undefined);

export const RoundCalculationProvider = ({
  children,
  round,
  holes,
}: {
  children: ReactNode;
  round: RoundWithCourseAndTee;
  holes: Tables<"hole">[];
}) => {
  const [par, setPar] = useState(round.courseEighteenHolePar);
  const [holesPlayed, setHolesPlayed] = useState(holes.length);
  const [handicapIndex, setHandicapIndex] = useState(
    round.existingHandicapIndex
  );
  const [slope, setSlope] = useState(round.courseSlope);
  const [rating, setRating] = useState(round.courseRating);
  const [isNineHoles, setIsNineHoles] = useState(holesPlayed === 9);
  const [adjustedPlayedScore, setAdjustedPlayedScore] = useState(
    calculateAdjustedPlayedScore(holes)
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
      handicapIndex,
      slope,
      rating,
      par,
      holesPlayed
    );
  }, [
    adjustedPlayedScore,
    courseHandicapCalculation,
    par,
    holesPlayed,
    isNineHoles,
  ]);

  const scoreDifferentialCalculation = useMemo(() => {
    return calculateScoreDifferential(
      adjustedGrossScoreCalculation,
      rating,
      slope
    );
  }, [adjustedGrossScoreCalculation, rating, slope]);

  const courseHcpStat = calculateCourseHandicap(
    round.existingHandicapIndex,
    round.courseSlope,
    round.courseRating,
    round.courseEighteenHolePar
  );

  const apsStat = calculateAdjustedPlayedScore(holes);

  return (
    <RoundCalculationContext.Provider
      value={{
        round,
        holes,
        par,
        setPar,
        holesPlayed,
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
