"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Muted, P } from "@/components/ui/typography";
import { CalculatorCard } from "./calculator-card";
import { useCalculatorContext } from "@/contexts/calculatorContext";
import { getCalculatorById } from "@/lib/calculator-registry";

const meta = getCalculatorById("playing-handicap")!;

// Common handicap allowances per USGA
const FORMAT_ALLOWANCES = [
  { id: "stroke", name: "Individual Stroke Play", allowance: 100 },
  { id: "match", name: "Individual Match Play", allowance: 100 },
  { id: "fourball-stroke", name: "Four-Ball Stroke Play", allowance: 85 },
  { id: "fourball-match", name: "Four-Ball Match Play", allowance: 90 },
  { id: "foursomes", name: "Foursomes", allowance: 50 },
  { id: "stableford", name: "Stableford", allowance: 95 },
];

export function PlayingHandicapCalculator() {
  const { values, setValue } = useCalculatorContext();
  const [format, setFormat] = useState("stroke");

  const selectedFormat = FORMAT_ALLOWANCES.find((f) => f.id === format);

  const playingHandicap = useMemo(() => {
    if (values.courseHandicap === null || !selectedFormat) return null;
    return Math.round(values.courseHandicap * (selectedFormat.allowance / 100));
  }, [values.courseHandicap, selectedFormat]);

  const result = (
    <div className="flex items-center justify-between">
      <P className="font-medium">Playing Handicap:</P>
      <span className="text-3xl font-bold text-primary">
        {playingHandicap !== null ? playingHandicap : "—"}
      </span>
    </div>
  );

  const explanation = (
    <div className="space-y-3">
      <Muted>Playing Handicap = Course Handicap x Handicap Allowance %</Muted>
      {playingHandicap !== null && selectedFormat && (
        <div className="bg-muted/50 rounded-lg p-3 font-mono text-sm">
          <P className="text-muted-foreground">
            {values.courseHandicap} x {selectedFormat.allowance}%
          </P>
          <P className="font-bold mt-1">= {playingHandicap}</P>
        </div>
      )}
      <Muted className="text-xs">
        Different formats of play use different handicap allowances to ensure
        fair competition.
      </Muted>
    </div>
  );

  return (
    <CalculatorCard meta={meta} result={result} explanation={explanation}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="courseHandicap-play">Course Handicap</Label>
          <Input
            id="courseHandicap-play"
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
        <div className="space-y-2">
          <Label htmlFor="format">Format of Play</Label>
          <Select value={format} onValueChange={setFormat}>
            <SelectTrigger id="format">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FORMAT_ALLOWANCES.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.name} ({f.allowance}%)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </CalculatorCard>
  );
}
