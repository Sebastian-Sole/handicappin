"use client";

import { CourseHandicapCalculator } from "./course-handicap-calculator";
import { ScoreDifferentialCalculator } from "./score-differential-calculator";
import { HandicapIndexCalculator } from "./handicap-index-calculator";
import { NetScoreCalculator } from "./net-score-calculator";
import { PlayingHandicapCalculator } from "./playing-handicap-calculator";
import { WhatIfCalculator } from "./what-if-calculator";
import { ExceptionalScoreCalculator } from "./exceptional-score-calculator";
import { TargetScoreCalculator } from "./target-score-calculator";
import { HandicapCapsCalculator } from "./handicap-caps-calculator";
import { NineHoleCalculator } from "./nine-hole-calculator";
import { StrokesReceivedCalculator } from "./strokes-received-calculator";
import { MaxScoreCalculator } from "./max-score-calculator";

interface CalculatorGridProps {
  category: "core" | "advanced" | "educational";
}

export function CalculatorGrid({ category }: CalculatorGridProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {category === "core" && (
        <>
          <CourseHandicapCalculator />
          <ScoreDifferentialCalculator />
          <HandicapIndexCalculator />
          <NetScoreCalculator />
        </>
      )}
      {category === "advanced" && (
        <>
          <PlayingHandicapCalculator />
          <WhatIfCalculator />
          <ExceptionalScoreCalculator />
          <TargetScoreCalculator />
        </>
      )}
      {category === "educational" && (
        <>
          <HandicapCapsCalculator />
          <NineHoleCalculator />
          <StrokesReceivedCalculator />
          <MaxScoreCalculator />
        </>
      )}
    </div>
  );
}
