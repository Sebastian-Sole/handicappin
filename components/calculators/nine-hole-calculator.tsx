"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Muted, P, Small } from "@/components/ui/typography";
import { CalculatorCard } from "./calculator-card";
import { useCalculatorContext } from "@/contexts/calculatorContext";
import { getCalculatorById } from "@/lib/calculator-registry";
import {
  calculate9HoleScoreDifferential,
  calculateExpected9HoleDifferential,
} from "@/lib/handicap";
import { ArrowRight } from "lucide-react";

const meta = getCalculatorById("nine-hole-equivalency")!;

export function NineHoleCalculator() {
  const { values, setValue } = useCalculatorContext();
  const [nineHoleScore, setNineHoleScore] = useState<number | null>(null);

  // Use values from context, with 9-hole specific overrides
  const nineHoleCourseRating = values.courseRating;
  const nineHoleSlopeRating = values.slopeRating;
  const nineHolePar = values.par;

  const calculation = useMemo(() => {
    if (
      values.handicapIndex === null ||
      nineHoleCourseRating === null ||
      nineHoleSlopeRating === null ||
      nineHolePar === null ||
      nineHoleScore === null
    ) {
      return null;
    }

    // Expected differential for the unplayed 9 holes
    const expectedDifferential = calculateExpected9HoleDifferential(
      values.handicapIndex,
      nineHoleCourseRating,
      nineHoleSlopeRating,
      nineHolePar
    );

    // Played differential
    const playedDifferential =
      (nineHoleScore - nineHoleCourseRating) * (113 / nineHoleSlopeRating);

    // Combined 18-hole equivalent
    const equivalentDifferential = calculate9HoleScoreDifferential(
      nineHoleScore,
      nineHoleCourseRating,
      nineHoleSlopeRating,
      expectedDifferential
    );

    return {
      playedDifferential: Math.round(playedDifferential * 10) / 10,
      expectedDifferential: Math.round(expectedDifferential * 10) / 10,
      equivalentDifferential,
    };
  }, [
    values.handicapIndex,
    nineHoleCourseRating,
    nineHoleSlopeRating,
    nineHolePar,
    nineHoleScore,
  ]);

  const result = calculation && (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4 text-center">
        <div className="p-3 bg-muted/50 rounded-lg">
          <Small className="text-muted-foreground">Played 9</Small>
          <P className="text-xl font-bold">
            {calculation.playedDifferential.toFixed(1)}
          </P>
        </div>
        <div className="flex items-center justify-center">
          <ArrowRight className="h-5 w-5 text-muted-foreground" />
          <span className="mx-1 text-muted-foreground">+</span>
          <ArrowRight className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="p-3 bg-muted/50 rounded-lg">
          <Small className="text-muted-foreground">Expected 9</Small>
          <P className="text-xl font-bold">
            {calculation.expectedDifferential.toFixed(1)}
          </P>
        </div>
      </div>

      <div className="flex items-center justify-between p-4 bg-primary/10 rounded-lg">
        <P className="font-medium">18-Hole Equivalent:</P>
        <span className="text-3xl font-bold text-primary">
          {calculation.equivalentDifferential.toFixed(1)}
        </span>
      </div>
    </div>
  );

  const explanation = (
    <div className="space-y-3">
      <Muted>9-hole rounds are converted to 18-hole equivalents by adding:</Muted>
      <ol className="list-decimal pl-4 space-y-2 text-sm text-muted-foreground">
        <li>
          <strong>Played 9-hole differential:</strong> Calculated from your
          actual score using the 9-hole course rating and slope
        </li>
        <li>
          <strong>Expected 9-hole differential:</strong> Based on your handicap
          index, estimating what you would score on the unplayed 9 holes
        </li>
      </ol>
      <Muted className="text-xs">
        This ensures 9-hole rounds have appropriate weight in your handicap
        calculation.
      </Muted>
    </div>
  );

  return (
    <CalculatorCard meta={meta} result={result} explanation={explanation}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="nineHoleScore">9-Hole Score</Label>
          <Input
            id="nineHoleScore"
            type="number"
            placeholder="e.g., 42"
            value={nineHoleScore ?? ""}
            onChange={(e) =>
              setNineHoleScore(e.target.value ? parseInt(e.target.value) : null)
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="handicapIndex-9hole">Handicap Index</Label>
          <Input
            id="handicapIndex-9hole"
            type="number"
            step="0.1"
            placeholder="e.g., 12.4"
            value={values.handicapIndex ?? ""}
            onChange={(e) =>
              setValue(
                "handicapIndex",
                e.target.value ? parseFloat(e.target.value) : null
              )
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="courseRating-9hole">9-Hole Course Rating</Label>
          <Input
            id="courseRating-9hole"
            type="number"
            step="0.1"
            placeholder="e.g., 35.2"
            value={values.courseRating ?? ""}
            onChange={(e) =>
              setValue(
                "courseRating",
                e.target.value ? parseFloat(e.target.value) : null
              )
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="slopeRating-9hole">9-Hole Slope Rating</Label>
          <Input
            id="slopeRating-9hole"
            type="number"
            placeholder="e.g., 125"
            value={values.slopeRating ?? ""}
            onChange={(e) =>
              setValue(
                "slopeRating",
                e.target.value ? parseInt(e.target.value) : null
              )
            }
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="par-9hole">9-Hole Par</Label>
          <Input
            id="par-9hole"
            type="number"
            placeholder="e.g., 36"
            value={values.par ?? ""}
            onChange={(e) =>
              setValue("par", e.target.value ? parseInt(e.target.value) : null)
            }
          />
        </div>
      </div>
    </CalculatorCard>
  );
}
