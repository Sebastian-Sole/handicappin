"use client";

import { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Muted, P, Small } from "@/components/ui/typography";
import { Progress } from "@/components/ui/progress";
import { CalculatorCard } from "./calculator-card";
import { useCalculatorContext } from "@/contexts/calculatorContext";
import { getCalculatorByIdOrThrow } from "@/lib/calculator-registry";
import { applyHandicapCaps } from "@/lib/handicap";
import {
  SOFT_CAP_THRESHOLD,
  HARD_CAP_THRESHOLD,
} from "@/lib/handicap/constants";

const meta = getCalculatorByIdOrThrow("handicap-caps");

export function HandicapCapsCalculator() {
  const { values, setValue } = useCalculatorContext();

  const analysis = useMemo(() => {
    if (
      values.handicapIndex === null ||
      values.lowHandicapIndex === null
    ) {
      return null;
    }

    const uncappedIndex = values.handicapIndex;
    const cappedIndex = applyHandicapCaps(uncappedIndex, values.lowHandicapIndex);
    const difference = uncappedIndex - values.lowHandicapIndex;

    const softCapLimit = values.lowHandicapIndex + SOFT_CAP_THRESHOLD;
    const hardCapLimit = values.lowHandicapIndex + HARD_CAP_THRESHOLD;

    let status: "below" | "soft" | "hard" = "below";
    if (difference > HARD_CAP_THRESHOLD) {
      status = "hard";
    } else if (difference > SOFT_CAP_THRESHOLD) {
      status = "soft";
    }

    // Calculate progress percentage (0-100) within the cap range
    const progressPercent = Math.max(
      0,
      Math.min(100, (difference / HARD_CAP_THRESHOLD) * 100)
    );

    return {
      uncappedIndex,
      cappedIndex,
      difference,
      softCapLimit,
      hardCapLimit,
      status,
      progressPercent,
      wasReduced: cappedIndex < uncappedIndex,
    };
  }, [values.handicapIndex, values.lowHandicapIndex]);

  const result = analysis && (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <P className="font-medium">Capped Handicap Index:</P>
          {analysis.wasReduced && (
            <Small className="text-amber-600">
              Reduced from {analysis.uncappedIndex.toFixed(1)}
            </Small>
          )}
        </div>
        <span className="text-3xl font-bold text-primary">
          {analysis.cappedIndex.toFixed(1)}
        </span>
      </div>

      {/* Visual cap progress bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Low HI: {values.lowHandicapIndex?.toFixed(1)}</span>
          <span>
            Soft Cap (+{SOFT_CAP_THRESHOLD}): {analysis.softCapLimit.toFixed(1)}
          </span>
          <span>
            Hard Cap (+{HARD_CAP_THRESHOLD}): {analysis.hardCapLimit.toFixed(1)}
          </span>
        </div>
        <div className="relative">
          <Progress value={analysis.progressPercent} className="h-3" />
          {/* Soft cap marker */}
          <div
            className="absolute top-0 h-3 w-0.5 bg-amber-500"
            style={{
              left: `${(SOFT_CAP_THRESHOLD / HARD_CAP_THRESHOLD) * 100}%`,
            }}
          />
        </div>
        <div className="flex justify-center">
          <span
            className={`text-sm font-medium ${
              analysis.status === "below"
                ? "text-green-600"
                : analysis.status === "soft"
                  ? "text-amber-600"
                  : "text-red-600"
            }`}
          >
            {analysis.status === "below" && "Below soft cap - no reduction"}
            {analysis.status === "soft" &&
              "Soft cap active - 50% reduction on increase"}
            {analysis.status === "hard" &&
              "Hard cap reached - maximum +5.0 from low"}
          </span>
        </div>
      </div>
    </div>
  );

  const explanation = (
    <div className="space-y-3">
      <Muted>
        The cap procedure limits how much your Handicap Index can increase above
        your Low Handicap Index (your lowest index in the past 365 days).
      </Muted>
      <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-2">
        <P className="font-medium">Cap Rules:</P>
        <ul className="list-disc pl-4 space-y-1 text-muted-foreground">
          <li>
            <strong>Soft Cap (+3.0):</strong> Increases above 3.0 are reduced by
            50%
          </li>
          <li>
            <strong>Hard Cap (+5.0):</strong> Maximum increase is capped at 5.0
            strokes
          </li>
        </ul>
      </div>
      {analysis?.wasReduced && (
        <div className="bg-amber-50 dark:bg-amber-950 rounded-lg p-3 text-sm">
          <P className="font-medium text-amber-800 dark:text-amber-200">
            Your handicap was reduced by{" "}
            {(analysis.uncappedIndex - analysis.cappedIndex).toFixed(1)} strokes
            due to the {analysis.status} cap.
          </P>
        </div>
      )}
    </div>
  );

  return (
    <CalculatorCard meta={meta} result={result} explanation={explanation}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="handicapIndex-caps">Current Handicap Index</Label>
          <Input
            id="handicapIndex-caps"
            type="number"
            step="0.1"
            placeholder="e.g., 15.2"
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
          <Label htmlFor="lowHandicapIndex">Low Handicap Index (365 days)</Label>
          <Input
            id="lowHandicapIndex"
            type="number"
            step="0.1"
            placeholder="e.g., 10.5"
            value={values.lowHandicapIndex ?? ""}
            onChange={(e) =>
              setValue(
                "lowHandicapIndex",
                e.target.value ? parseFloat(e.target.value) : null
              )
            }
          />
        </div>
      </div>
    </CalculatorCard>
  );
}
