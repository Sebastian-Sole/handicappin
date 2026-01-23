"use client";

import { Muted, P, Blockquote } from "@/components/ui/typography";
import { CalculationStep } from "../calculation-step";
import { useRoundCalculationContext } from "@/contexts/roundCalculationContext";
import { calculateHoleAdjustedScore } from "@/lib/handicap";
import Link from "next/link";

const AdjustedScoresStep = () => {
  const { scorecard, apsStat, hasEstablishedHandicap } = useRoundCalculationContext();

  // Calculate how many holes had scores capped
  const cappedHoles = scorecard.teePlayed.holes
    ?.slice(0, scorecard.scores.length)
    .filter((hole) => {
      const score = scorecard.scores[hole.holeNumber - 1];
      if (!score) return false;
      const adjustedScore = calculateHoleAdjustedScore(hole, score, hasEstablishedHandicap);
      return adjustedScore < score.strokes;
    });

  const totalStrokes = scorecard.scores.reduce(
    (acc, score) => acc + score.strokes,
    0
  );
  const adjustmentAmount = totalStrokes - apsStat;

  return (
    <CalculationStep
      stepNumber={2}
      title="Adjusted Scores"
      description="How your hole scores were capped for handicap purposes"
      learnMoreContent={
        <div className="space-y-3">
          <Blockquote>
            The USGA limits the maximum score you can post on any hole to
            prevent one bad hole from disproportionately affecting your
            handicap. This is called &quot;Net Double Bogey&quot; adjustment.
          </Blockquote>
          <P>
            The maximum score per hole is the lower of:
          </P>
          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
            <li>Par + 5 (absolute maximum)</li>
            <li>Par + 2 + your handicap strokes on that hole</li>
          </ul>
          <P>
            For example, on a Par 4 where you receive 1 handicap stroke, your
            maximum adjusted score is the lower of 9 (4+5) or 7 (4+2+1) = 7.
          </P>
          <Link
            href="https://www.usga.org/handicapping/roh/Content/rules/3%202%20Acceptable%20Scores.htm"
            target="_blank"
            className="text-primary hover:underline text-sm"
          >
            Read more about Acceptable Scores (USGA)
          </Link>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Summary stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-muted/50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold">{totalStrokes}</div>
            <Muted>Total Strokes</Muted>
          </div>
          <div className="bg-muted/50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold">{apsStat}</div>
            <Muted>Adjusted Score</Muted>
          </div>
          <div className="bg-muted/50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-amber-600">
              {cappedHoles?.length || 0}
            </div>
            <Muted>Holes Capped</Muted>
          </div>
          <div className="bg-muted/50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-green-600">
              -{adjustmentAmount}
            </div>
            <Muted>Strokes Saved</Muted>
          </div>
        </div>

        {/* Explanation */}
        {cappedHoles && cappedHoles.length > 0 ? (
          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
            <P className="text-amber-800 dark:text-amber-200">
              {cappedHoles.length} hole{cappedHoles.length > 1 ? "s were" : " was"}{" "}
              adjusted: Hole{cappedHoles.length > 1 ? "s" : ""}{" "}
              {cappedHoles.map((h) => h.holeNumber).join(", ")}. This saved you{" "}
              {adjustmentAmount} stroke{adjustmentAmount > 1 ? "s" : ""} in your
              handicap calculation.
            </P>
          </div>
        ) : (
          <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <P className="text-green-800 dark:text-green-200">
              No holes were capped - all your scores were within the Net Double
              Bogey limit.
            </P>
          </div>
        )}

        {/* Formula reminder */}
        <div className="bg-muted/50 rounded-lg p-4">
          <Muted>
            Adjusted Played Score = Sum of all adjusted hole scores
          </Muted>
          <div className="flex items-center gap-2 mt-2">
            <span className="font-medium">Adjusted Played Score =</span>
            <span className="text-xl font-bold text-primary">{apsStat}</span>
          </div>
        </div>
      </div>
    </CalculationStep>
  );
};

export default AdjustedScoresStep;
