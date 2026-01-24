"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Muted, P, Blockquote } from "@/components/ui/typography";
import { CalculationStep } from "../calculation-step";
import { useRoundCalculationContext } from "@/contexts/roundCalculationContext";
import { RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

const ScoreDifferentialStep = () => {
  const {
    adjustedGrossScoreCalculation,
    adjustedPlayedScore,
    rating,
    setRating,
    slope,
    setSlope,
    scoreDifferentialCalculation,
    playedDifferential,
    expectedDifferential,
    isNineHoles,
    scorecard,
  } = useRoundCalculationContext();

  // Original values
  const originalSlope = isNineHoles
    ? scorecard.teePlayed.slopeRatingFront9
    : scorecard.teePlayed.slopeRating18;
  const originalRating = isNineHoles
    ? scorecard.teePlayed.courseRatingFront9
    : scorecard.teePlayed.courseRating18;

  const hasChanges = slope !== originalSlope || rating !== originalRating;

  const resetToOriginal = () => {
    setSlope(originalSlope);
    setRating(originalRating);
  };

  const isModified = (current: number, original: number) => current !== original;

  return (
    <CalculationStep
      stepNumber={3}
      title="Score Differential"
      description="Your performance relative to course difficulty"
      learnMoreContent={
        <div className="space-y-3">
          <Blockquote>
            The Score Differential measures how well you played compared to the
            difficulty of the course. It normalizes your score across different
            courses by accounting for both Course Rating and Slope Rating.
          </Blockquote>
          <P>
            A lower Score Differential indicates better performance. Your
            Handicap Index is calculated from your best Score Differentials.
          </P>
          {isNineHoles && (
            <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mt-4">
              <P className="text-blue-800 dark:text-blue-200 text-sm">
                <strong>9-Hole Round Note:</strong> Since you played 9 holes,
                your Score Differential is calculated as an 18-hole equivalent.
                This combines your actual 9-hole performance with an
                &quot;expected&quot; score for the unplayed 9 holes based on
                your Handicap Index.
              </P>
            </div>
          )}
          <Link
            href="https://www.usga.org/handicapping/roh/Content/rules/5%201%20Calculation%20of%20a%20Score%20Differential.htm"
            target="_blank"
            className="text-primary hover:underline text-sm"
            rel="noopener noreferrer"
          >
            Read more about Score Differential calculation (USGA)
          </Link>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Reset button */}
        {hasChanges && (
          <Button
            variant="outline"
            size="sm"
            onClick={resetToOriginal}
            className="gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            Reset to original values
          </Button>
        )}

        {/* Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <Label>{isNineHoles ? "Adjusted Played Score (9 holes)" : "Adjusted Gross Score"}</Label>
            <Input
              value={isNineHoles ? adjustedPlayedScore : adjustedGrossScoreCalculation}
              disabled
              className="bg-muted"
            />
          </div>
          <div>
            <Label>Course Rating {isNineHoles && "(Front 9)"}</Label>
            <Input
              type="number"
              step="0.1"
              value={rating !== 0 ? rating : ""}
              onChange={(e) =>
                setRating(Number.parseFloat(e.target.value) || 0)
              }
              className={cn(
                isModified(rating, originalRating) &&
                  "border-amber-500 bg-amber-50 dark:bg-amber-950/20"
              )}
            />
          </div>
          <div>
            <Label>Slope Rating {isNineHoles && "(Front 9)"}</Label>
            <Input
              type="number"
              value={slope !== 0 ? slope : ""}
              onChange={(e) => setSlope(Number(e.target.value) || 0)}
              className={cn(
                isModified(slope, originalSlope) &&
                  "border-amber-500 bg-amber-50 dark:bg-amber-950/20"
              )}
            />
          </div>
        </div>

        {/* Formula - different for 9-hole vs 18-hole */}
        {isNineHoles ? (
          <div className="bg-muted/50 rounded-lg p-4 space-y-4">
            <Muted>
              9-Hole Score Differential = Played Differential + Expected Differential
            </Muted>

            {/* Played Differential */}
            <div className="space-y-1">
              <div className="text-sm font-medium">Played Differential (Front 9):</div>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Muted>
                  ({adjustedPlayedScore} − {rating}) × 113 ÷ {slope}
                </Muted>
                <span className="font-medium">=</span>
                <span className="font-semibold">{playedDifferential.toFixed(2)}</span>
              </div>
            </div>

            {/* Expected Differential */}
            <div className="space-y-1">
              <div className="text-sm font-medium">Expected Differential (Unplayed 9):</div>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Muted>Based on handicap index {scorecard.round.existingHandicapIndex}</Muted>
                <span className="font-medium">=</span>
                <span className="font-semibold">{expectedDifferential.toFixed(2)}</span>
              </div>
            </div>

            {/* Combined */}
            <div className="border-t pt-3 mt-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">18-Hole Equivalent =</span>
                <Muted>{playedDifferential.toFixed(2)} + {expectedDifferential.toFixed(2)}</Muted>
                <span className="font-medium">=</span>
                <span className="text-xl font-bold text-primary">
                  {scoreDifferentialCalculation.toFixed(1)}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <Muted>
              Score Differential = (Adjusted Gross Score − Course Rating) × 113 ÷ Slope Rating
            </Muted>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">Score Differential =</span>
              <Muted>
                ({adjustedGrossScoreCalculation} − {rating}) × 113 ÷ {slope}
              </Muted>
              <span className="font-medium">=</span>
              <span className="text-xl font-bold text-primary">
                {scoreDifferentialCalculation.toFixed(1)}
              </span>
            </div>
          </div>
        )}

        {/* 9-hole info note */}
        {isNineHoles && (
          <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <P className="text-blue-800 dark:text-blue-200 text-sm">
              <strong>Note:</strong> Per USGA Rule 5.1b, 9-hole rounds are converted to 18-hole equivalents
              by combining your actual played differential with an expected differential for the unplayed holes.
            </P>
          </div>
        )}
      </div>
    </CalculationStep>
  );
};

export default ScoreDifferentialStep;
