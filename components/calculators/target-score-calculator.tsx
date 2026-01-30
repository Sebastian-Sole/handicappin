"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Muted, P, Small } from "@/components/ui/typography";
import { CalculatorCard } from "./calculator-card";
import { useCalculatorContext } from "@/contexts/calculatorContext";
import { getCalculatorByIdOrThrow } from "@/lib/calculator-registry";
import { Target } from "lucide-react";

const meta = getCalculatorByIdOrThrow("target-score");

export function TargetScoreCalculator() {
  const { values } = useCalculatorContext();
  const [targetHandicap, setTargetHandicap] = useState<number | null>(null);

  const calculation = useMemo(() => {
    if (
      targetHandicap === null ||
      values.courseRating === null ||
      values.slopeRating === null
    ) {
      return null;
    }

    // To achieve a target handicap, we need a differential equal to or better than that target
    // Score Differential = (Score - Course Rating) × (113 / Slope)
    // Rearranging: Score = (Differential × Slope / 113) + Course Rating
    const targetDifferential = targetHandicap;
    const targetScore = Math.floor(
      (targetDifferential * values.slopeRating) / 113 + values.courseRating
    );

    // Also calculate what differential would result from various scores
    const scoresToShow = [targetScore - 2, targetScore - 1, targetScore, targetScore + 1, targetScore + 2];
    const scoreBreakdown = scoresToShow.map((score) => {
      const diff = ((score - values.courseRating!) * 113) / values.slopeRating!;
      return {
        score,
        differential: Math.round(diff * 10) / 10,
        meetsTarget: diff <= targetDifferential,
      };
    });

    return {
      targetScore,
      targetDifferential,
      scoreBreakdown,
    };
  }, [targetHandicap, values.courseRating, values.slopeRating]);

  const result = calculation && (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" />
          <P className="font-medium">Target Score:</P>
        </div>
        <span className="text-3xl font-bold text-primary">
          {calculation.targetScore}
        </span>
      </div>

      {/* Score breakdown table */}
      <div className="space-y-2">
        <Small className="text-muted-foreground">Score breakdown:</Small>
        <div className="grid grid-cols-5 gap-1 text-center text-sm">
          {calculation.scoreBreakdown.map(({ score, differential, meetsTarget }) => (
            <div
              key={score}
              className={`p-2 rounded ${
                meetsTarget
                  ? "bg-green-100 dark:bg-green-900/30"
                  : "bg-muted/50"
              }`}
            >
              <div className="font-bold">{score}</div>
              <div className="text-xs text-muted-foreground">
                {differential.toFixed(1)}
              </div>
            </div>
          ))}
        </div>
        <Small className="text-muted-foreground">
          Green scores would achieve your target differential
        </Small>
      </div>
    </div>
  );

  const explanation = (
    <div className="space-y-3">
      <Muted>
        This calculator works backwards from your target handicap index to find
        what score you need to shoot. The formula rearranges the score
        differential calculation:
      </Muted>
      <div className="bg-muted/50 rounded-lg p-3 font-mono text-sm">
        <P className="text-muted-foreground">
          Target Score = (Target Diff × Slope / 113) + Course Rating
        </P>
      </div>
      <Muted className="text-xs">
        Note: Your actual handicap index is calculated from your best
        differentials, so one good round may not immediately change your index.
      </Muted>
    </div>
  );

  return (
    <CalculatorCard meta={meta} result={result} explanation={explanation}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="targetHandicap">Target Handicap Index</Label>
          <Input
            id="targetHandicap"
            type="number"
            step="0.1"
            placeholder="e.g., 10.0"
            value={targetHandicap ?? ""}
            onChange={(e) =>
              setTargetHandicap(
                e.target.value ? parseFloat(e.target.value) : null
              )
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="currentHandicap-target">Current Handicap</Label>
          <Input
            id="currentHandicap-target"
            type="number"
            step="0.1"
            value={values.handicapIndex ?? ""}
            readOnly
            className="bg-muted"
            placeholder="From other calculators"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="courseRating-target">Course Rating</Label>
          <Input
            id="courseRating-target"
            type="number"
            step="0.1"
            placeholder="e.g., 72.3"
            value={values.courseRating ?? ""}
            readOnly
            className="bg-muted"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="slopeRating-target">Slope Rating</Label>
          <Input
            id="slopeRating-target"
            type="number"
            placeholder="e.g., 130"
            value={values.slopeRating ?? ""}
            readOnly
            className="bg-muted"
          />
        </div>
      </div>
      {(values.courseRating === null || values.slopeRating === null) && (
        <Muted className="text-sm text-amber-600">
          Enter course and slope rating in the Course Handicap calculator first.
        </Muted>
      )}
    </CalculatorCard>
  );
}
