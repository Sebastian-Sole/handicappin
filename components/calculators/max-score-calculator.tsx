"use client";

import { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Muted, P, Small } from "@/components/ui/typography";
import { Badge } from "@/components/ui/badge";
import { CalculatorCard } from "./calculator-card";
import { useCalculatorContext } from "@/contexts/calculatorContext";
import { getCalculatorByIdOrThrow } from "@/lib/calculator-registry";

const meta = getCalculatorByIdOrThrow("max-score");

// Standard par values for demonstration
const SAMPLE_HOLES = [
  { hole: 1, par: 4, hcp: 7 },
  { hole: 2, par: 3, hcp: 15 },
  { hole: 3, par: 5, hcp: 1 },
  { hole: 4, par: 4, hcp: 11 },
  { hole: 5, par: 4, hcp: 5 },
  { hole: 6, par: 3, hcp: 17 },
  { hole: 7, par: 4, hcp: 3 },
  { hole: 8, par: 5, hcp: 13 },
  { hole: 9, par: 4, hcp: 9 },
  { hole: 10, par: 4, hcp: 8 },
  { hole: 11, par: 3, hcp: 16 },
  { hole: 12, par: 5, hcp: 2 },
  { hole: 13, par: 4, hcp: 12 },
  { hole: 14, par: 4, hcp: 6 },
  { hole: 15, par: 3, hcp: 18 },
  { hole: 16, par: 4, hcp: 4 },
  { hole: 17, par: 5, hcp: 14 },
  { hole: 18, par: 4, hcp: 10 },
];

export function MaxScoreCalculator() {
  const { values, setValue } = useCalculatorContext();

  const holeMaxScores = useMemo(() => {
    if (values.courseHandicap === null) return [];

    const courseHcp = Math.max(0, values.courseHandicap);

    return SAMPLE_HOLES.map((hole) => {
      // Calculate strokes received on this hole
      const fullStrokes = Math.floor(courseHcp / 18);
      const remainder = courseHcp % 18;
      const strokesReceived = fullStrokes + (hole.hcp <= remainder ? 1 : 0);

      // Net Double Bogey = Par + 2 + strokes received
      // But max is Par + 5 (even with many strokes)
      const netDoubleBogey = hole.par + 2 + strokesReceived;
      const maxScore = Math.min(netDoubleBogey, hole.par + 5);

      return {
        ...hole,
        strokesReceived,
        maxScore,
      };
    });
  }, [values.courseHandicap]);

  const result = values.courseHandicap !== null && holeMaxScores.length > 0 && (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex flex-wrap gap-2">
        <Badge variant="secondary">Course HCP: {values.courseHandicap}</Badge>
        <Badge variant="outline">
          Max possible: {holeMaxScores.reduce((sum, h) => sum + h.maxScore, 0)}
        </Badge>
      </div>

      {/* Hole grid - Front 9 */}
      <div>
        <Small className="text-muted-foreground mb-2 block">Front 9</Small>
        <div className="grid grid-cols-9 gap-1 text-center text-xs">
          {holeMaxScores.slice(0, 9).map((hole) => (
            <div key={hole.hole} className="space-y-1">
              <div className="text-muted-foreground">{hole.hole}</div>
              <div className="bg-muted/50 rounded p-1">
                <div className="text-muted-foreground">P{hole.par}</div>
                <div className="font-bold text-primary">{hole.maxScore}</div>
                {hole.strokesReceived > 0 ? (
                  <div className="text-[10px] text-green-600">
                    +{hole.strokesReceived}
                  </div>
                ) : (
                  <div className="text-[10px] text-muted-foreground">0</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Hole grid - Back 9 */}
      <div>
        <Small className="text-muted-foreground mb-2 block">Back 9</Small>
        <div className="grid grid-cols-9 gap-1 text-center text-xs">
          {holeMaxScores.slice(9).map((hole) => (
            <div key={hole.hole} className="space-y-1">
              <div className="text-muted-foreground">{hole.hole}</div>
              <div className="bg-muted/50 rounded p-1">
                <div className="text-muted-foreground">P{hole.par}</div>
                <div className="font-bold text-primary">{hole.maxScore}</div>
                {hole.strokesReceived > 0 ? (
                  <div className="text-[10px] text-green-600">
                    +{hole.strokesReceived}
                  </div>
                ) : (
                  <div className="text-[10px] text-muted-foreground">0</div>
                )}
              </div>
            </div>
          ))}
        </div>
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
          Max = Par + 2 + Handicap Strokes on Hole
        </P>
        <P className="text-xs text-muted-foreground">
          (Maximum of Par + 5, even with many handicap strokes)
        </P>
      </div>
      <div className="text-sm space-y-1">
        <P className="font-medium">Examples:</P>
        <ul className="list-disc pl-4 space-y-1 text-muted-foreground">
          <li>Par 4, 0 strokes: Max = 4 + 2 + 0 = 6</li>
          <li>Par 5, 1 stroke: Max = 5 + 2 + 1 = 8</li>
          <li>Par 4, 4 strokes: Max = 4 + 2 + 4 = 10, but capped at 9 (Par + 5)</li>
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
                e.target.value ? parseInt(e.target.value) : null,
              )
            }
          />
        </div>
        <Muted className="text-xs">
          Using a sample course layout. Your actual max scores depend on each
          hole&apos;s par and handicap allocation.
        </Muted>
      </div>
    </CalculatorCard>
  );
}
