"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";
import { CalculatorSkeleton } from "./calculator-skeleton";

// Lazy load all calculators with dynamic imports
const CourseHandicapCalculator = dynamic(
  () =>
    import("./course-handicap-calculator").then(
      (mod) => mod.CourseHandicapCalculator
    ),
  { loading: () => <CalculatorSkeleton /> }
);

const ScoreDifferentialCalculator = dynamic(
  () =>
    import("./score-differential-calculator").then(
      (mod) => mod.ScoreDifferentialCalculator
    ),
  { loading: () => <CalculatorSkeleton /> }
);

const HandicapIndexCalculator = dynamic(
  () =>
    import("./handicap-index-calculator").then(
      (mod) => mod.HandicapIndexCalculator
    ),
  { loading: () => <CalculatorSkeleton /> }
);

const NetScoreCalculator = dynamic(
  () =>
    import("./net-score-calculator").then((mod) => mod.NetScoreCalculator),
  { loading: () => <CalculatorSkeleton /> }
);

const PlayingHandicapCalculator = dynamic(
  () =>
    import("./playing-handicap-calculator").then(
      (mod) => mod.PlayingHandicapCalculator
    ),
  { loading: () => <CalculatorSkeleton /> }
);

const WhatIfCalculator = dynamic(
  () => import("./what-if-calculator").then((mod) => mod.WhatIfCalculator),
  { loading: () => <CalculatorSkeleton /> }
);

const ExceptionalScoreCalculator = dynamic(
  () =>
    import("./exceptional-score-calculator").then(
      (mod) => mod.ExceptionalScoreCalculator
    ),
  { loading: () => <CalculatorSkeleton /> }
);

const TargetScoreCalculator = dynamic(
  () =>
    import("./target-score-calculator").then(
      (mod) => mod.TargetScoreCalculator
    ),
  { loading: () => <CalculatorSkeleton /> }
);

const HandicapCapsCalculator = dynamic(
  () =>
    import("./handicap-caps-calculator").then(
      (mod) => mod.HandicapCapsCalculator
    ),
  { loading: () => <CalculatorSkeleton /> }
);

const NineHoleCalculator = dynamic(
  () =>
    import("./nine-hole-calculator").then((mod) => mod.NineHoleCalculator),
  { loading: () => <CalculatorSkeleton /> }
);

const StrokesReceivedCalculator = dynamic(
  () =>
    import("./strokes-received-calculator").then(
      (mod) => mod.StrokesReceivedCalculator
    ),
  { loading: () => <CalculatorSkeleton /> }
);

const MaxScoreCalculator = dynamic(
  () =>
    import("./max-score-calculator").then((mod) => mod.MaxScoreCalculator),
  { loading: () => <CalculatorSkeleton /> }
);

interface CalculatorGridProps {
  category: "core" | "advanced" | "educational";
}

export function CalculatorGrid({ category }: CalculatorGridProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {category === "core" && (
        <>
          <Suspense fallback={<CalculatorSkeleton />}>
            <CourseHandicapCalculator />
          </Suspense>
          <Suspense fallback={<CalculatorSkeleton />}>
            <ScoreDifferentialCalculator />
          </Suspense>
          <Suspense fallback={<CalculatorSkeleton />}>
            <HandicapIndexCalculator />
          </Suspense>
          <Suspense fallback={<CalculatorSkeleton />}>
            <NetScoreCalculator />
          </Suspense>
        </>
      )}
      {category === "advanced" && (
        <>
          <Suspense fallback={<CalculatorSkeleton />}>
            <PlayingHandicapCalculator />
          </Suspense>
          <Suspense fallback={<CalculatorSkeleton />}>
            <WhatIfCalculator />
          </Suspense>
          <Suspense fallback={<CalculatorSkeleton />}>
            <ExceptionalScoreCalculator />
          </Suspense>
          <Suspense fallback={<CalculatorSkeleton />}>
            <TargetScoreCalculator />
          </Suspense>
        </>
      )}
      {category === "educational" && (
        <>
          <Suspense fallback={<CalculatorSkeleton />}>
            <HandicapCapsCalculator />
          </Suspense>
          <Suspense fallback={<CalculatorSkeleton />}>
            <NineHoleCalculator />
          </Suspense>
          <Suspense fallback={<CalculatorSkeleton />}>
            <StrokesReceivedCalculator />
          </Suspense>
          <Suspense fallback={<CalculatorSkeleton />}>
            <MaxScoreCalculator />
          </Suspense>
        </>
      )}
    </div>
  );
}
