"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Muted, P, Small } from "@/components/ui/typography";
import { CalculatorCard } from "./calculator-card";
import { useCalculatorContext } from "@/contexts/calculatorContext";
import { getCalculatorById } from "@/lib/calculator-registry";
import {
  calculateScoreDifferential,
  calculateHandicapIndex,
} from "@/lib/handicap";
import { ArrowRight, TrendingDown, TrendingUp, Minus } from "lucide-react";

const meta = getCalculatorById("what-if-scenario")!;

export function WhatIfCalculator() {
  const { values } = useCalculatorContext();
  const [hypotheticalScore, setHypotheticalScore] = useState<number | null>(
    null
  );

  const hypotheticalDifferential = useMemo(() => {
    if (
      hypotheticalScore === null ||
      values.courseRating === null ||
      values.slopeRating === null
    ) {
      return null;
    }
    return calculateScoreDifferential(
      hypotheticalScore,
      values.courseRating,
      values.slopeRating
    );
  }, [hypotheticalScore, values.courseRating, values.slopeRating]);

  const projectedHandicap = useMemo(() => {
    if (hypotheticalDifferential === null) return null;
    if (values.scoreDifferentials.length < 2) return null;

    // Add the hypothetical to existing differentials
    const newDifferentials = [
      ...values.scoreDifferentials,
      hypotheticalDifferential,
    ];
    // Limit to 20 most recent
    const recentDifferentials = newDifferentials.slice(-20);

    if (recentDifferentials.length < 3) return null;
    return calculateHandicapIndex(recentDifferentials);
  }, [hypotheticalDifferential, values.scoreDifferentials]);

  const handicapChange = useMemo(() => {
    if (projectedHandicap === null || values.handicapIndex === null)
      return null;
    return projectedHandicap - values.handicapIndex;
  }, [projectedHandicap, values.handicapIndex]);

  const result = (
    <div className="space-y-4">
      {hypotheticalDifferential !== null && (
        <div className="flex items-center justify-between">
          <P className="font-medium">Hypothetical Differential:</P>
          <span className="text-2xl font-bold">
            {hypotheticalDifferential.toFixed(1)}
          </span>
        </div>
      )}
      {projectedHandicap !== null && values.handicapIndex !== null && (
        <div className="flex items-center gap-4">
          <div className="text-center">
            <Small className="text-muted-foreground">Current</Small>
            <P className="text-xl font-bold">{values.handicapIndex.toFixed(1)}</P>
          </div>
          <ArrowRight className="h-5 w-5 text-muted-foreground" />
          <div className="text-center">
            <Small className="text-muted-foreground">Projected</Small>
            <P className="text-xl font-bold text-primary">
              {projectedHandicap.toFixed(1)}
            </P>
          </div>
          {handicapChange !== null && (
            <div
              className={`flex items-center gap-1 ${
                handicapChange < 0
                  ? "text-green-600"
                  : handicapChange > 0
                    ? "text-red-600"
                    : "text-muted-foreground"
              }`}
            >
              {handicapChange < 0 ? (
                <TrendingDown className="h-4 w-4" />
              ) : handicapChange > 0 ? (
                <TrendingUp className="h-4 w-4" />
              ) : (
                <Minus className="h-4 w-4" />
              )}
              <span className="font-medium">
                {handicapChange > 0 ? "+" : ""}
                {handicapChange.toFixed(1)}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );

  const explanation = (
    <div className="space-y-3">
      <Muted>
        This calculator shows how a hypothetical round would affect your
        handicap index. It calculates the score differential and projects your
        new handicap.
      </Muted>
      <Muted className="text-xs">
        Note: Actual results may vary based on soft/hard caps, ESR, and other
        factors.
      </Muted>
    </div>
  );

  return (
    <CalculatorCard meta={meta} result={result} explanation={explanation}>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="space-y-2">
          <Label htmlFor="hypotheticalScore">Hypothetical Score</Label>
          <Input
            id="hypotheticalScore"
            type="number"
            placeholder="e.g., 82"
            value={hypotheticalScore ?? ""}
            onChange={(e) =>
              setHypotheticalScore(
                e.target.value ? parseInt(e.target.value) : null
              )
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="courseRating-whatif">Course Rating</Label>
          <Input
            id="courseRating-whatif"
            type="number"
            step="0.1"
            placeholder="e.g., 72.3"
            value={values.courseRating ?? ""}
            readOnly
            className="bg-muted"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="slopeRating-whatif">Slope Rating</Label>
          <Input
            id="slopeRating-whatif"
            type="number"
            placeholder="e.g., 130"
            value={values.slopeRating ?? ""}
            readOnly
            className="bg-muted"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="currentHandicap">Current Handicap</Label>
          <Input
            id="currentHandicap"
            type="number"
            step="0.1"
            value={values.handicapIndex ?? ""}
            readOnly
            className="bg-muted"
          />
        </div>
      </div>
      {values.scoreDifferentials.length < 2 && (
        <Muted className="text-sm text-amber-600">
          Add at least 2 differentials in the Handicap Index calculator to see
          projections.
        </Muted>
      )}
    </CalculatorCard>
  );
}
