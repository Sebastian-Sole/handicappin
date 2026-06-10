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
  { ssr: false, loading: () => <CalculatorSkeleton /> }
);

const ScoreDifferentialCalculator = dynamic(
  () =>
    import("./score-differential-calculator").then(
      (mod) => mod.ScoreDifferentialCalculator
    ),
  { ssr: false, loading: () => <CalculatorSkeleton /> }
);

const HandicapIndexCalculator = dynamic(
  () =>
    import("./handicap-index-calculator").then(
      (mod) => mod.HandicapIndexCalculator
    ),
  { ssr: false, loading: () => <CalculatorSkeleton /> }
);

const NetScoreCalculator = dynamic(
  () =>
    import("./net-score-calculator").then((mod) => mod.NetScoreCalculator),
  { ssr: false, loading: () => <CalculatorSkeleton /> }
);

const PlayingHandicapCalculator = dynamic(
  () =>
    import("./playing-handicap-calculator").then(
      (mod) => mod.PlayingHandicapCalculator
    ),
  { ssr: false, loading: () => <CalculatorSkeleton /> }
);

const WhatIfCalculator = dynamic(
  () => import("./what-if-calculator").then((mod) => mod.WhatIfCalculator),
  { ssr: false, loading: () => <CalculatorSkeleton /> }
);

const ExceptionalScoreCalculator = dynamic(
  () =>
    import("./exceptional-score-calculator").then(
      (mod) => mod.ExceptionalScoreCalculator
    ),
  { ssr: false, loading: () => <CalculatorSkeleton /> }
);

const TargetScoreCalculator = dynamic(
  () =>
    import("./target-score-calculator").then(
      (mod) => mod.TargetScoreCalculator
    ),
  { ssr: false, loading: () => <CalculatorSkeleton /> }
);

const HandicapCapsCalculator = dynamic(
  () =>
    import("./handicap-caps-calculator").then(
      (mod) => mod.HandicapCapsCalculator
    ),
  { ssr: false, loading: () => <CalculatorSkeleton /> }
);

const NineHoleCalculator = dynamic(
  () =>
    import("./nine-hole-calculator").then((mod) => mod.NineHoleCalculator),
  { ssr: false, loading: () => <CalculatorSkeleton /> }
);

const StrokesReceivedCalculator = dynamic(
  () =>
    import("./strokes-received-calculator").then(
      (mod) => mod.StrokesReceivedCalculator
    ),
  { ssr: false, loading: () => <CalculatorSkeleton /> }
);

const MaxScoreCalculator = dynamic(
  () =>
    import("./max-score-calculator").then((mod) => mod.MaxScoreCalculator),
  { ssr: false, loading: () => <CalculatorSkeleton /> }
);

interface CalculatorGridProps {
  category: "core" | "advanced" | "educational";
}

export function CalculatorGrid({ category }: CalculatorGridProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-lg">
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
