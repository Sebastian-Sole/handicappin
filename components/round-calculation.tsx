"use client";

import { H2, H3 } from "./ui/typography";
import { Separator } from "./ui/separator";
import HolesTable from "./round/calculation/holesTable";
import StatCalculationDisplay from "./round/calculation/statCalculationDisplay";
import {
  RoundCalculationProvider,
  useRoundCalculationContext,
} from "@/contexts/roundCalculationContext";
import CourseHandicapCalculationDisplay from "./round/calculation/courseHcpCalculationDisplay";
import AGSCalculationDisplay from "./round/calculation/AGSCalculationDisplay";
import ScoreDiffCalculationDisplay from "./round/calculation/ScoreDiffCalculationDisplay";
import { ScorecardWithRound } from "@/types/scorecard";

interface RoundCalculationProps {
  scorecard: ScorecardWithRound;
}

const RoundCalculationContent = () => {
  const { scorecard } = useRoundCalculationContext();
  return (
    <div className="container mx-auto px-4 sm:px-6 md:px-8 py-8 space-y-8">
      <section className="space-y-4">
        <H2>
          {`${scorecard.course.name} - ${new Date(
            scorecard.teeTime
          ).toDateString()} - Score: ${scorecard.round.adjustedGrossScore}`}
        </H2>
        <H3>Hole-by-hole results</H3>
        <HolesTable />
      </section>
      <StatCalculationDisplay />
      <Separator />
      <CourseHandicapCalculationDisplay />
      <Separator />
      <AGSCalculationDisplay />
      <Separator />
      <ScoreDiffCalculationDisplay />
    </div>
  );
};

export function RoundCalculation({ scorecard }: RoundCalculationProps) {
  return (
    <RoundCalculationProvider scorecard={scorecard}>
      <RoundCalculationContent />
    </RoundCalculationProvider>
  );
}
