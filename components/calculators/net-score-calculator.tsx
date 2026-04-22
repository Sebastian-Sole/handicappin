"use client";

import { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Muted, P } from "@/components/ui/typography";
import { CalculatorCard } from "./calculator-card";
import { useCalculatorContext } from "@/contexts/calculatorContext";
import { getCalculatorByIdOrThrow } from "@/lib/calculator-registry";

const meta = getCalculatorByIdOrThrow("net-score");

export function NetScoreCalculator() {
  const { values, setValue } = useCalculatorContext();

  const netScore = useMemo(() => {
    if (
      values.adjustedGrossScore === null ||
      values.courseHandicap === null
    ) {
      return null;
    }
    return values.adjustedGrossScore - values.courseHandicap;
  }, [values.adjustedGrossScore, values.courseHandicap]);

  const result = (
    <div className="flex items-center justify-between">
      <P className="font-medium">Net Score:</P>
      <span className="text-3xl font-bold text-primary">
        {netScore !== null ? netScore : "—"}
      </span>
    </div>
  );

  const explanation = (
    <div className="space-y-sm">
      <Muted>Net Score = Gross Score - Course Handicap</Muted>
      {netScore !== null && (
        <div className="surface-muted p-sm font-mono text-sm">
          <P className="text-muted-foreground">
            {values.adjustedGrossScore} - {values.courseHandicap}
          </P>
          <P className="font-bold mt-xs">= {netScore}</P>
        </div>
      )}
      <Muted className="text-xs">
        Your net score is used to determine your performance relative to par
        after accounting for your handicap. A net score equal to par means you
        played to your handicap.
      </Muted>
    </div>
  );

  return (
    <CalculatorCard meta={meta} result={result} explanation={explanation}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-md">
        <div className="space-y-sm">
          <Label htmlFor="grossScore-net">Gross Score</Label>
          <Input
            id="grossScore-net"
            type="number"
            placeholder="e.g., 92"
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
          <Label htmlFor="courseHandicap-net">Course Handicap</Label>
          <Input
            id="courseHandicap-net"
            type="number"
            placeholder="e.g., 18"
            value={values.courseHandicap ?? ""}
            onChange={(e) =>
              setValue(
                "courseHandicap",
                e.target.value ? parseInt(e.target.value) : null
              )
            }
          />
        </div>
      </div>
    </CalculatorCard>
  );
}
