"use client";

import { useEffect, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Muted, P } from "@/components/ui/typography";
import { CalculatorCard } from "./calculator-card";
import { useCalculatorContext } from "@/contexts/calculatorContext";
import { getCalculatorByIdOrThrow } from "@/lib/calculator-registry";

const meta = getCalculatorByIdOrThrow("course-handicap");

export function CourseHandicapCalculator() {
  const { values, setValue, setLastUpdatedBy } = useCalculatorContext();

  const courseHandicap = useMemo(() => {
    const { handicapIndex, slopeRating, courseRating, par, holesPlayed } =
      values;
    if (
      handicapIndex === null ||
      slopeRating === null ||
      courseRating === null ||
      par === null
    ) {
      return null;
    }

    if (holesPlayed === 9) {
      return Math.round(
        (handicapIndex / 2) * (slopeRating / 113) + (courseRating - par)
      );
    }
    return Math.round(
      handicapIndex * (slopeRating / 113) + (courseRating - par)
    );
  }, [values]);

  // Update shared context when result changes
  useEffect(() => {
    setValue("courseHandicap", courseHandicap);
    if (courseHandicap !== null) {
      setLastUpdatedBy("courseHandicap", meta.id);
    }
  }, [courseHandicap, setValue, setLastUpdatedBy]);

  const result = (
    <div className="flex items-center justify-between">
      <P className="font-medium">Course Handicap:</P>
      <span className="text-3xl font-bold text-primary">
        {courseHandicap !== null ? courseHandicap : "—"}
      </span>
    </div>
  );

  const explanation = (
    <div className="space-y-3">
      <Muted>
        {values.holesPlayed === 9 ? (
          <span>
            Course Handicap (9 holes) = (Handicap Index / 2) x (Slope / 113) +
            (Course Rating - Par)
          </span>
        ) : (
          <span>
            Course Handicap = Handicap Index x (Slope / 113) + (Course Rating -
            Par)
          </span>
        )}
      </Muted>
      {courseHandicap !== null && values.handicapIndex !== null && (
        <div className="bg-muted/50 rounded-lg p-3 font-mono text-sm">
          <P className="text-muted-foreground">
            {values.holesPlayed === 9 ? (
              <>
                ({values.handicapIndex} / 2) x ({values.slopeRating} / 113) + (
                {values.courseRating} - {values.par})
              </>
            ) : (
              <>
                {values.handicapIndex} x ({values.slopeRating} / 113) + (
                {values.courseRating} - {values.par})
              </>
            )}
          </P>
          <P className="font-bold mt-1">= {courseHandicap}</P>
        </div>
      )}
    </div>
  );

  return (
    <CalculatorCard meta={meta} result={result} explanation={explanation}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="handicapIndex">Handicap Index</Label>
          <Input
            id="handicapIndex"
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
          <Label htmlFor="slopeRating">Slope Rating</Label>
          <Input
            id="slopeRating"
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
        <div className="space-y-2">
          <Label htmlFor="courseRating">Course Rating</Label>
          <Input
            id="courseRating"
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
        <div className="space-y-2">
          <Label htmlFor="par">Par</Label>
          <Input
            id="par"
            type="number"
            placeholder="e.g., 72"
            value={values.par ?? ""}
            onChange={(e) =>
              setValue("par", e.target.value ? parseInt(e.target.value) : null)
            }
          />
        </div>
      </div>
      <div className="flex items-center gap-3 pt-2">
        <Label htmlFor="holesPlayed">18 holes</Label>
        <Switch
          id="holesPlayed"
          checked={values.holesPlayed === 9}
          onCheckedChange={(checked) =>
            setValue("holesPlayed", checked ? 9 : 18)
          }
        />
        <Label htmlFor="holesPlayed">9 holes</Label>
      </div>
    </CalculatorCard>
  );
}
