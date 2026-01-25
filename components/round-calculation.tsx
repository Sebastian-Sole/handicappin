"use client";

import { H2, Muted } from "./ui/typography";
import { Separator } from "./ui/separator";
import { Card, CardHeader } from "./ui/card";
import { Badge } from "./ui/badge";
import { CalculationStepper } from "./ui/calculation-stepper";
import HolesTable from "./round/calculation/holesTable";
import CourseHandicapStep from "./round/calculation/steps/course-handicap-step";
import AdjustedScoresStep from "./round/calculation/steps/adjusted-scores-step";
import ScoreDifferentialStep from "./round/calculation/steps/score-differential-step";
import HandicapImpactStep from "./round/calculation/steps/handicap-impact-step";
import ScoreDistributionSidebar from "./round/calculation/score-distribution-sidebar";
import {
  RoundCalculationProvider,
  useRoundCalculationContext,
} from "@/contexts/roundCalculationContext";
import { ScorecardWithRound } from "@/types/scorecard-input";
import { CalendarDays, MapPin, Flag } from "lucide-react";

interface RoundCalculationProps {
  scorecard: ScorecardWithRound;
}

const CALCULATION_STEPS = [
  { id: 1, title: "Course Handicap" },
  { id: 2, title: "Adjusted Scores" },
  { id: 3, title: "Score Differential" },
  { id: 4, title: "Handicap Impact" },
];

const RoundCalculationContent = () => {
  const { scorecard, isNineHoles } = useRoundCalculationContext();
  const roundDate = new Date(scorecard.teeTime).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="container mx-auto px-4 sm:px-6 md:px-8 py-8 space-y-8">
      {/* Round Overview Card */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <H2 className="mb-2">{scorecard.course.name}</H2>
              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <CalendarDays className="w-4 h-4" />
                  {roundDate}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  {scorecard.teePlayed.name}
                </span>
                <span className="flex items-center gap-1">
                  <Flag className="w-4 h-4" />
                  {isNineHoles ? "9 Holes" : "18 Holes"}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-primary">
                  {scorecard.round.adjustedGrossScore}
                </div>
                <Muted>Score</Muted>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold">
                  {Number(scorecard.round.scoreDifferential).toFixed(1)}
                </div>
                <Muted>Differential</Muted>
              </div>
            </div>
          </div>
          {isNineHoles && (
            <Badge variant="secondary" className="w-fit mt-4">
              9-Hole Round - Calculated as 18-hole equivalent
            </Badge>
          )}
        </CardHeader>
      </Card>

      {/* Stepper Progress */}
      <CalculationStepper steps={CALCULATION_STEPS} className="py-4" />

      {/* Hole-by-Hole Results */}
      <section className="space-y-4">
        <H2>Hole-by-Hole Results</H2>
        <Muted>
          Your scores for each hole, with handicap strokes and adjusted scores.
        </Muted>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          <div className="lg:col-span-2">
            <HolesTable />
          </div>
          <div className="lg:col-span-1">
            <ScoreDistributionSidebar />
          </div>
        </div>
      </section>

      <Separator />

      {/* Step 1: Course Handicap */}
      <CourseHandicapStep />

      <Separator />

      {/* Step 2: Adjusted Scores */}
      <AdjustedScoresStep />

      <Separator />

      {/* Step 3: Score Differential */}
      <ScoreDifferentialStep />

      <Separator />

      {/* Step 4: Handicap Impact */}
      <HandicapImpactStep />
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
