"use client";

import { Muted, P, Blockquote } from "@/components/ui/typography";
import { StatTile } from "@/components/ui/stat-tile";
import { CalculationStep } from "../calculation-step";
import { useRoundCalculationContext } from "@/contexts/roundCalculationContext";
import { calculateHoleAdjustedScore } from "@handicappin/handicap-core";
import Link from "next/link";

const AdjustedScoresStep = () => {
  const { scorecard, apsStat, hasEstablishedHandicap } =
    useRoundCalculationContext();

  // Calculate how many holes had scores capped
  const cappedHoles = scorecard.teePlayed.holes
    ?.slice(0, scorecard.scores.length)
    .filter((hole) => {
      const score = scorecard.scores[hole.holeNumber - 1];
      if (!score) return false;
      const adjustedScore = calculateHoleAdjustedScore(
        hole,
        score,
        hasEstablishedHandicap
      );
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
        <div className="space-y-sm">
          <Blockquote>
            The USGA limits the maximum score you can post on any hole to
            prevent one bad hole from disproportionately affecting your
            handicap. This is called &quot;Net Double Bogey&quot; adjustment.
          </Blockquote>
          <P>The maximum score per hole is the lower of:</P>
          <ul className="list-disc list-inside space-y-xs text-sm text-muted-foreground">
            <li>Par + 5 (absolute maximum)</li>
            <li>Par + 2 + your handicap strokes on that hole</li>
          </ul>
          <P>
            For example, on a Par 4 where you receive 1 handicap stroke, your
            maximum adjusted score is the lower of 9 (4+5) or 7 (4+2+1) = 7.
          </P>
          <P className="text-xs italic">
            Note: Players with fewer than 3 approved rounds use a simpler Par +
            5 maximum on all holes.
          </P>
          <Link
            href="https://www.usga.org/handicapping/roh/Content/rules/3%201a%20Before%20a%20Handicap%20Index%20Has%20Been%20Established.htm"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline text-sm"
          >
            Read more about Acceptable Scores (USGA)
          </Link>
        </div>
      }
    >
      <div className="space-y-md">
        {/* Summary stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-md">
          <div className="surface-muted p-md">
            <StatTile value={totalStrokes} label="Total Strokes" />
          </div>
          <div className="surface-muted p-md">
            <StatTile value={apsStat} label="Adjusted Score" />
          </div>
          <div className="surface-muted p-md">
            <StatTile
              value={
                <span className="text-warning">
                  {cappedHoles?.length || 0}
                </span>
              }
              label="Holes Capped"
            />
          </div>
          <div className="surface-muted p-md">
            <StatTile
              value={
                <span className="text-success">
                  {adjustmentAmount > 0
                    ? `-${adjustmentAmount}`
                    : adjustmentAmount}
                </span>
              }
              label="Strokes Saved"
            />
          </div>
        </div>

        {/* Explanation */}
        {cappedHoles && cappedHoles.length > 0 ? (
          <div className="tint-warning p-md">
            <P className="text-warning">
              {cappedHoles.length} hole
              {cappedHoles.length > 1 ? "s were" : " was"} adjusted: Hole
              {cappedHoles.length > 1 ? "s" : ""}{" "}
              {cappedHoles.map((h) => h.holeNumber).join(", ")}. This saved you{" "}
              {adjustmentAmount} stroke{adjustmentAmount > 1 ? "s" : ""} in your
              handicap calculation.
            </P>
          </div>
        ) : (
          <div className="tint-success p-md">
            <P className="text-success">
              No holes were capped - all your scores were within the Net Double
              Bogey limit.
            </P>
          </div>
        )}

        {/* Formula reminder */}
        <div className="surface-muted p-md">
          <Muted>Adjusted Played Score = Sum of all adjusted hole scores</Muted>
          <div className="flex items-center gap-sm mt-sm">
            <span className="font-medium">Adjusted Played Score =</span>
            <span className="text-figure-sm text-primary">{apsStat}</span>
          </div>
        </div>
      </div>
    </CalculationStep>
  );
};

export default AdjustedScoresStep;
