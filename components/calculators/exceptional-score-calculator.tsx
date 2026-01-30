"use client";

import { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Muted, P } from "@/components/ui/typography";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CalculatorCard } from "./calculator-card";
import { useCalculatorContext } from "@/contexts/calculatorContext";
import { getCalculatorByIdOrThrow } from "@/lib/calculator-registry";
import { EXCEPTIONAL_ROUND_THRESHOLD } from "@/lib/handicap/constants";
import { AlertTriangle, CheckCircle } from "lucide-react";

const meta = getCalculatorByIdOrThrow("exceptional-score");

export function ExceptionalScoreCalculator() {
  const { values, setValue } = useCalculatorContext();

  const analysis = useMemo(() => {
    if (
      values.handicapIndex === null ||
      values.scoreDifferential === null
    ) {
      return null;
    }

    const difference = values.handicapIndex - values.scoreDifferential;
    const isExceptional = difference >= EXCEPTIONAL_ROUND_THRESHOLD;

    // ESR adjustment calculation
    let esrAdjustment = 0;
    if (isExceptional) {
      if (difference >= 10) {
        esrAdjustment = -2;
      } else if (difference >= 7) {
        esrAdjustment = -1;
      }
    }

    return {
      difference,
      isExceptional,
      esrAdjustment,
      threshold: EXCEPTIONAL_ROUND_THRESHOLD,
    };
  }, [values.handicapIndex, values.scoreDifferential]);

  const result = analysis && (
    <div className="space-y-4">
      <Alert variant={analysis.isExceptional ? "destructive" : "default"}>
        {analysis.isExceptional ? (
          <>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Exceptional Score Detected</AlertTitle>
            <AlertDescription>
              This round is {analysis.difference.toFixed(1)} strokes better than
              your handicap index. ESR adjustment: {analysis.esrAdjustment} to
              handicap index.
            </AlertDescription>
          </>
        ) : (
          <>
            <CheckCircle className="h-4 w-4" />
            <AlertTitle>Normal Score</AlertTitle>
            <AlertDescription>
              This round is within the normal range (
              {analysis.difference.toFixed(1)} strokes{" "}
              {analysis.difference >= 0 ? "better" : "worse"} than handicap). No
              ESR adjustment applies.
            </AlertDescription>
          </>
        )}
      </Alert>

      <div className="flex items-center gap-2">
        <Badge variant={analysis.isExceptional ? "destructive" : "secondary"}>
          {analysis.isExceptional ? "ESR Applies" : "No ESR"}
        </Badge>
        {analysis.esrAdjustment !== 0 && (
          <Badge variant="outline">Adjustment: {analysis.esrAdjustment}</Badge>
        )}
      </div>
    </div>
  );

  const explanation = (
    <div className="space-y-3">
      <Muted>
        An Exceptional Score is a round with a score differential at least{" "}
        {EXCEPTIONAL_ROUND_THRESHOLD} strokes better than your Handicap Index.
        When this happens, ESR reduces your handicap immediately.
      </Muted>
      <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-2">
        <P className="font-medium">ESR Adjustments:</P>
        <ul className="list-disc pl-4 space-y-1 text-muted-foreground">
          <li>7.0 to 9.9 strokes better: -1.0 adjustment</li>
          <li>10.0+ strokes better: -2.0 adjustment</li>
        </ul>
      </div>
    </div>
  );

  return (
    <CalculatorCard meta={meta} result={result} explanation={explanation}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="handicapIndex-esr">Handicap Index</Label>
          <Input
            id="handicapIndex-esr"
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
          <Label htmlFor="scoreDifferential-esr">Score Differential</Label>
          <Input
            id="scoreDifferential-esr"
            type="number"
            step="0.1"
            placeholder="e.g., 4.2"
            value={values.scoreDifferential ?? ""}
            onChange={(e) =>
              setValue(
                "scoreDifferential",
                e.target.value ? parseFloat(e.target.value) : null
              )
            }
          />
        </div>
      </div>
    </CalculatorCard>
  );
}
