"use client";

import { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Muted, P, Small } from "@/components/ui/typography";
import { Badge } from "@/components/ui/badge";
import { CalculatorCard } from "./calculator-card";
import { useCalculatorContext } from "@/contexts/calculatorContext";
import { getCalculatorById } from "@/lib/calculator-registry";

const meta = getCalculatorById("strokes-received")!;

// Default hole handicap allocation (1 = hardest, 18 = easiest)
const DEFAULT_HOLE_HANDICAPS = [
  1, 11, 5, 15, 3, 13, 7, 17, 9, 2, 12, 6, 16, 4, 14, 8, 18, 10,
];

export function StrokesReceivedCalculator() {
  const { values, setValue } = useCalculatorContext();

  const strokesPerHole = useMemo(() => {
    if (values.courseHandicap === null) return [];

    const courseHcp = Math.max(0, values.courseHandicap);
    return DEFAULT_HOLE_HANDICAPS.map((holeHcp) => {
      // Full strokes everyone gets
      const fullStrokes = Math.floor(courseHcp / 18);
      // Extra stroke if hole handicap <= remainder
      const remainder = courseHcp % 18;
      const extraStroke = holeHcp <= remainder ? 1 : 0;
      return fullStrokes + extraStroke;
    });
  }, [values.courseHandicap]);

  const totalStrokes = strokesPerHole.reduce((sum, s) => sum + s, 0);

  const result = values.courseHandicap !== null && (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <P className="font-medium">Total Strokes:</P>
        <span className="text-2xl font-bold text-primary">{totalStrokes}</span>
      </div>

      {/* Visual hole grid */}
      <div className="grid grid-cols-9 gap-1 sm:gap-2">
        {/* Front 9 */}
        {strokesPerHole.slice(0, 9).map((strokes, idx) => (
          <div key={idx} className="text-center">
            <Small className="text-muted-foreground">{idx + 1}</Small>
            <div
              className={`p-1 sm:p-2 rounded ${
                strokes > 0 ? "bg-primary/20" : "bg-muted/50"
              }`}
            >
              <span className="font-bold text-sm sm:text-base">{strokes}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-9 gap-1 sm:gap-2">
        {/* Back 9 */}
        {strokesPerHole.slice(9).map((strokes, idx) => (
          <div key={idx + 9} className="text-center">
            <Small className="text-muted-foreground">{idx + 10}</Small>
            <div
              className={`p-1 sm:p-2 rounded ${
                strokes > 0 ? "bg-primary/20" : "bg-muted/50"
              }`}
            >
              <span className="font-bold text-sm sm:text-base">{strokes}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Summary badges */}
      <div className="flex flex-wrap gap-2">
        {strokesPerHole.filter((s) => s > 0).length > 0 && (
          <Badge variant="secondary">
            {strokesPerHole.filter((s) => s > 0).length} holes with strokes
          </Badge>
        )}
        {strokesPerHole.filter((s) => s >= 2).length > 0 && (
          <Badge variant="outline">
            {strokesPerHole.filter((s) => s >= 2).length} holes with 2+ strokes
          </Badge>
        )}
      </div>
    </div>
  );

  const explanation = (
    <div className="space-y-3">
      <Muted>
        Handicap strokes are distributed across holes based on their difficulty
        rating (Hole Handicap). Lower hole handicap = harder hole = receives
        strokes first.
      </Muted>
      <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-2">
        <P className="font-medium">Distribution Rules:</P>
        <ul className="list-disc pl-4 space-y-1 text-muted-foreground">
          <li>
            Strokes are distributed one per hole, starting with the hardest (HCP
            1)
          </li>
          <li>
            After all 18 holes have 1 stroke, distribution continues from HCP 1
            again
          </li>
          <li>
            Course Handicap of 20 = 2 strokes on HCP 1-2 holes, 1 stroke on
            others
          </li>
        </ul>
      </div>
    </div>
  );

  return (
    <CalculatorCard meta={meta} result={result} explanation={explanation}>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="courseHandicap-strokes">Course Handicap</Label>
          <Input
            id="courseHandicap-strokes"
            type="number"
            placeholder="e.g., 14"
            value={values.courseHandicap ?? ""}
            onChange={(e) =>
              setValue(
                "courseHandicap",
                e.target.value ? parseInt(e.target.value) : null
              )
            }
          />
        </div>
        <Muted className="text-xs">
          Using standard hole handicap allocation. Your course may have a
          different allocation.
        </Muted>
      </div>
    </CalculatorCard>
  );
}
