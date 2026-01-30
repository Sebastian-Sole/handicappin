"use client";

import { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Muted, P } from "@/components/ui/typography";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalculatorCard } from "./calculator-card";
import { useCalculatorContext } from "@/contexts/calculatorContext";
import { getCalculatorByIdOrThrow } from "@/lib/calculator-registry";

const meta = getCalculatorByIdOrThrow("max-score");

export function MaxScoreCalculator() {
  const { values, setValue } = useCalculatorContext();

  const holePar = values.holePar ?? 4;
  const holeHcp = values.holeHcp ?? 1;

  const calculation = useMemo(() => {
    if (values.courseHandicap === null) return null;

    const courseHcp = Math.max(0, values.courseHandicap);

    // Calculate strokes received on this hole
    const fullStrokes = Math.floor(courseHcp / 18);
    const remainder = courseHcp % 18;
    const strokesReceived = fullStrokes + (holeHcp <= remainder ? 1 : 0);

    // Net Double Bogey = Par + 2 + strokes received
    // But max is Par + 5 (even with many strokes)
    const netDoubleBogey = holePar + 2 + strokesReceived;
    const maxScore = Math.min(netDoubleBogey, holePar + 5);
    const wasCapped = netDoubleBogey > maxScore;

    return {
      strokesReceived,
      netDoubleBogey,
      maxScore,
      wasCapped,
    };
  }, [values.courseHandicap, holePar, holeHcp]);

  const result = calculation && (
    <div className="space-y-4">
      {/* Main result */}
      <div className="text-center">
        <div className="text-5xl font-bold text-primary">
          {calculation.maxScore}
        </div>
        <Muted className="mt-1">Maximum Score</Muted>
      </div>

      {/* Breakdown */}
      <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-2">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Par</span>
          <span>{holePar}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Double Bogey</span>
          <span>{holePar + 2}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Handicap Strokes</span>
          <span className="text-green-600">+{calculation.strokesReceived}</span>
        </div>
        <div className="border-t pt-2 flex justify-between font-medium">
          <span>Net Double Bogey</span>
          <span>
            {calculation.wasCapped ? (
              <>
                <span className="line-through text-muted-foreground mr-2">
                  {calculation.netDoubleBogey}
                </span>
                {calculation.maxScore}
              </>
            ) : (
              calculation.maxScore
            )}
          </span>
        </div>
        {calculation.wasCapped && (
          <Muted className="text-xs">
            Capped at Par + 5 ({holePar + 5})
          </Muted>
        )}
      </div>
    </div>
  );

  const explanation = (
    <div className="space-y-3">
      <Muted>
        The maximum score you can post on any hole for handicap purposes is
        called <strong>Net Double Bogey</strong>. This prevents one bad hole
        from disproportionately affecting your handicap.
      </Muted>
      <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-2">
        <P className="font-medium">Net Double Bogey Formula:</P>
        <P className="font-mono text-muted-foreground">
          Max = Par + 2 + Handicap Strokes
        </P>
        <P className="text-xs text-muted-foreground">
          (Capped at Par + 5, even with many handicap strokes)
        </P>
      </div>
      <div className="text-sm space-y-1">
        <P className="font-medium">Examples:</P>
        <ul className="list-disc pl-4 space-y-1 text-muted-foreground">
          <li>Par 4, 0 strokes → Max = 6</li>
          <li>Par 5, 1 stroke → Max = 8</li>
          <li>Par 4, 4 strokes → Max = 9 (capped from 10)</li>
        </ul>
      </div>
    </div>
  );

  return (
    <CalculatorCard meta={meta} result={result} explanation={explanation}>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="courseHandicap-max">Course Handicap</Label>
          <Input
            id="courseHandicap-max"
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

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="holePar">Hole Par</Label>
            <Select
              value={holePar.toString()}
              onValueChange={(value) => setValue("holePar", parseInt(value))}
            >
              <SelectTrigger id="holePar">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3">Par 3</SelectItem>
                <SelectItem value="4">Par 4</SelectItem>
                <SelectItem value="5">Par 5</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="holeHcp">Hole Handicap</Label>
            <Select
              value={holeHcp.toString()}
              onValueChange={(value) => setValue("holeHcp", parseInt(value))}
            >
              <SelectTrigger id="holeHcp">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 18 }, (_, i) => i + 1).map((hcp) => (
                  <SelectItem key={hcp} value={hcp.toString()}>
                    {hcp}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Muted className="text-xs">
          Find hole handicap on your scorecard - it indicates difficulty (1 = hardest).
        </Muted>
      </div>
    </CalculatorCard>
  );
}
