"use client";

import { useEffect, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Muted, P } from "@/components/ui/typography";
import { CalculatorCard } from "./calculator-card";
import { useCalculatorContext } from "@/contexts/calculatorContext";
import { getCalculatorByIdOrThrow } from "@/lib/calculator-registry";
import { calculateScoreDifferential } from "@handicappin/handicap-core";

const meta = getCalculatorByIdOrThrow("score-differential");

export function ScoreDifferentialCalculator() {
  const { values, setValue, setLastUpdatedBy } = useCalculatorContext();

  const scoreDifferential = useMemo(() => {
    const { adjustedGrossScore, courseRating, slopeRating } = values;
    if (
      adjustedGrossScore === null ||
      courseRating === null ||
      slopeRating === null
    ) {
      return null;
    }
    return calculateScoreDifferential(
      adjustedGrossScore,
      courseRating,
      slopeRating
    );
  }, [values]);

  useEffect(() => {
    setValue("scoreDifferential", scoreDifferential);
    if (scoreDifferential !== null) {
      setLastUpdatedBy("scoreDifferential", meta.id);
    } else {
      setLastUpdatedBy("scoreDifferential", null);
    }
  }, [scoreDifferential, setValue, setLastUpdatedBy]);

  const result = (
    <div className="flex items-center justify-between">
      <P className="font-medium">Score Differential:</P>
      <span className="text-3xl font-bold text-primary">
        {scoreDifferential !== null ? scoreDifferential.toFixed(1) : "—"}
      </span>
    </div>
  );

  const explanation = (
    <div className="space-y-sm">
      <Muted>
        Score Differential = (Adjusted Gross Score - Course Rating) x (113 /
        Slope Rating)
      </Muted>
      {scoreDifferential !== null && (
        <div className="surface-muted p-sm font-mono text-sm">
          <P className="text-muted-foreground">
            ({values.adjustedGrossScore} - {values.courseRating}) x (113 /{" "}
            {values.slopeRating})
          </P>
          <P className="font-bold mt-xs">= {scoreDifferential.toFixed(1)}</P>
        </div>
      )}
      <Muted className="text-xs">
        Note: Negative differentials are rounded toward zero (ceiling).
      </Muted>
    </div>
  );

  return (
    <CalculatorCard meta={meta} result={result} explanation={explanation}>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-md">
        <div className="space-y-sm">
          <Label htmlFor="adjustedGrossScore">Adjusted Gross Score</Label>
          <Input
            id="adjustedGrossScore"
            type="number"
            placeholder="e.g., 85"
            value={values.adjustedGrossScore ?? ""}
            onChange={(e) =>
              setValue(
                "adjustedGrossScore",
                e.target.value ? parseInt(e.target.value) : null
              )
            }
          />
        </div>
        <div className="space-y-sm">
          <Label htmlFor="courseRating-diff">Course Rating</Label>
          <Input
            id="courseRating-diff"
            type="number"
            step="0.1"
            placeholder="e.g., 72.3"
            value={values.courseRating ?? ""}
            onChange={(e) =>
              setValue(
                "courseRating",
                e.target.value ? parseFloat(e.target.value) : null
              )
            }
          />
        </div>
        <div className="space-y-sm">
          <Label htmlFor="slopeRating-diff">Slope Rating</Label>
          <Input
            id="slopeRating-diff"
            type="number"
            placeholder="e.g., 130"
            value={values.slopeRating ?? ""}
            onChange={(e) =>
              setValue(
                "slopeRating",
                e.target.value ? parseInt(e.target.value) : null
              )
            }
          />
        </div>
      </div>
    </CalculatorCard>
  );
}
