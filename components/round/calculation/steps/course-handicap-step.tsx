"use client";

import { useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Muted, P, Blockquote } from "@/components/ui/typography";
import { CalculationStep } from "../calculation-step";
import { useRoundCalculationContext } from "@/contexts/roundCalculationContext";
import { RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

const CourseHandicapStep = () => {
  const {
    handicapIndex,
    setHandicapIndex,
    slope,
    setSlope,
    rating,
    setRating,
    par,
    setPar,
    isNineHoles,
    setIsNineHoles,
    setHolesPlayed,
    courseHandicapCalculation,
    scorecard,
  } = useRoundCalculationContext();

  // Original values for comparison
  const originalHandicapIndex = scorecard.round.existingHandicapIndex;
  const originalSlope = isNineHoles
    ? scorecard.teePlayed.slopeRatingFront9
    : scorecard.teePlayed.slopeRating18;
  const originalRating = isNineHoles
    ? scorecard.teePlayed.courseRatingFront9
    : scorecard.teePlayed.courseRating18;
  const originalPar = isNineHoles
    ? scorecard.teePlayed.outPar
    : scorecard.teePlayed.totalPar;

  // Sync slope, rating, and par when isNineHoles changes
  useEffect(() => {
    const newSlope = isNineHoles
      ? scorecard.teePlayed.slopeRatingFront9
      : scorecard.teePlayed.slopeRating18;
    const newRating = isNineHoles
      ? scorecard.teePlayed.courseRatingFront9
      : scorecard.teePlayed.courseRating18;
    const newPar = isNineHoles
      ? scorecard.teePlayed.outPar
      : scorecard.teePlayed.totalPar;

    setSlope(newSlope);
    setRating(newRating);
    setPar(newPar);
  }, [isNineHoles, scorecard.teePlayed, setSlope, setRating, setPar]);

  const hasChanges =
    handicapIndex !== originalHandicapIndex ||
    slope !== originalSlope ||
    rating !== originalRating ||
    par !== originalPar;

  const resetToOriginal = () => {
    setHandicapIndex(originalHandicapIndex);
    setSlope(originalSlope);
    setRating(originalRating);
    setPar(originalPar);
  };

  const isModified = (current: number, original: number) => current !== original;

  return (
    <CalculationStep
      stepNumber={1}
      title="Course Handicap"
      description="How many handicap strokes you received for this round"
      learnMoreContent={
        <div className="space-y-3">
          <Blockquote>
            Your Course Handicap represents the number of strokes you receive on
            this specific course and set of tees. It adjusts your Handicap Index
            to account for the difficulty of the course you&apos;re playing.
          </Blockquote>
          <P>
            The formula uses the Slope Rating (a measure of relative difficulty
            for bogey golfers compared to scratch golfers) and Course Rating
            (the expected score for a scratch golfer).
          </P>
          <Link
            href="https://www.usga.org/handicapping/roh/Content/rules/5%201%20Course%20Handicap%20Calculation.htm"
            target="_blank"
            className="text-primary hover:underline text-sm"
            rel="noopener noreferrer"
          >
            Read more about Course Handicap calculation (USGA)
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

        {/* Input grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <Label>Handicap Index</Label>
            <Input
              type="number"
              step="0.1"
              value={handicapIndex !== 0 ? handicapIndex : ""}
              onChange={(e) =>
                setHandicapIndex(Number.parseFloat(e.target.value) || 0)
              }
              className={cn(
                isModified(handicapIndex, originalHandicapIndex) &&
                  "border-amber-500 bg-amber-50 dark:bg-amber-950/20"
              )}
            />
          </div>
          <div>
            <Label>Slope Rating</Label>
            <Input
              type="number"
              value={slope !== 0 ? slope : ""}
              onChange={(e) =>
                setSlope(Number.parseFloat(e.target.value) || 0)
              }
              className={cn(
                isModified(slope, originalSlope) &&
                  "border-amber-500 bg-amber-50 dark:bg-amber-950/20"
              )}
            />
          </div>
          <div>
            <Label>Course Rating</Label>
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
            <Label>Par</Label>
            <Input
              type="number"
              value={par !== 0 ? par : ""}
              onChange={(e) => setPar(Number(e.target.value) || 0)}
              className={cn(
                isModified(par, originalPar) &&
                  "border-amber-500 bg-amber-50 dark:bg-amber-950/20"
              )}
            />
          </div>
          <div className="flex items-end gap-2 pb-2">
            <Label className="text-xs">18 holes</Label>
            <Switch
              checked={isNineHoles}
              onCheckedChange={(checked) => {
                setIsNineHoles(checked);
                setHolesPlayed(checked ? 9 : 18);
              }}
            />
            <Label className="text-xs">9 holes</Label>
          </div>
        </div>

        {/* Formula */}
        <div className="bg-muted/50 rounded-lg p-4 space-y-2">
          <Muted>
            {isNineHoles
              ? "Course Handicap (9 holes) = (Handicap Index ÷ 2) × (Slope ÷ 113) + (Course Rating − Par)"
              : "Course Handicap (18 holes) = Handicap Index × (Slope ÷ 113) + (Course Rating − Par)"}
          </Muted>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">Course Handicap =</span>
            <Muted>
              {isNineHoles ? `(${handicapIndex} ÷ 2)` : handicapIndex} × ({slope}{" "}
              ÷ 113) + ({rating} − {par})
            </Muted>
            <span className="font-medium">=</span>
            <span className="text-xl font-bold text-primary">
              {Math.round(courseHandicapCalculation)}
            </span>
            <Muted>strokes</Muted>
          </div>
        </div>
      </div>
    </CalculationStep>
  );
};

export default CourseHandicapStep;
