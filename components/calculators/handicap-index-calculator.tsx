"use client";

import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Muted, P, Small } from "@/components/ui/typography";
import { Badge } from "@/components/ui/badge";
import { CalculatorCard } from "./calculator-card";
import { useCalculatorContext } from "@/contexts/calculatorContext";
import { getCalculatorById } from "@/lib/calculator-registry";
import {
  calculateHandicapIndex,
  getRelevantDifferentials,
} from "@/lib/handicap";
import { Plus, X } from "lucide-react";

const meta = getCalculatorById("handicap-index")!;

export function HandicapIndexCalculator() {
  const { values, setValue, setLastUpdatedBy } = useCalculatorContext();
  const [newDifferential, setNewDifferential] = useState("");

  const differentials = values.scoreDifferentials;

  const addDifferential = () => {
    const value = parseFloat(newDifferential);
    if (!isNaN(value)) {
      setValue("scoreDifferentials", [...differentials, value]);
      setNewDifferential("");
    }
  };

  const removeDifferential = (index: number) => {
    setValue(
      "scoreDifferentials",
      differentials.filter((_, diffIndex) => diffIndex !== index)
    );
  };

  const handicapIndex = useMemo(() => {
    if (differentials.length < 3) return null;
    return calculateHandicapIndex(differentials);
  }, [differentials]);

  const relevantDifferentials = useMemo(() => {
    if (differentials.length === 0) return [];
    const sorted = [...differentials].sort((a, b) => a - b);
    return getRelevantDifferentials(sorted);
  }, [differentials]);

  // Compute which indices in the original differentials array are "used" in the calculation
  const usedIndices = useMemo(() => {
    if (differentials.length === 0) return new Set<number>();

    // Count how many of each value we need
    const neededCounts = new Map<number, number>();
    relevantDifferentials.forEach((diff) => {
      neededCounts.set(diff, (neededCounts.get(diff) || 0) + 1);
    });

    // Find indices that match, respecting the count limit
    const indices = new Set<number>();
    differentials.forEach((diff, index) => {
      const needed = neededCounts.get(diff) || 0;
      if (needed > 0) {
        indices.add(index);
        neededCounts.set(diff, needed - 1);
      }
    });

    return indices;
  }, [differentials, relevantDifferentials]);

  useEffect(() => {
    if (handicapIndex !== null) {
      setValue("handicapIndex", handicapIndex);
      setLastUpdatedBy("handicapIndex", meta.id);
    }
  }, [handicapIndex, setValue, setLastUpdatedBy]);

  const result = (
    <div className="flex items-center justify-between">
      <div>
        <P className="font-medium">Handicap Index:</P>
        {differentials.length < 3 && (
          <Small className="text-muted-foreground">
            Need {3 - differentials.length} more round(s)
          </Small>
        )}
      </div>
      <span className="text-3xl font-bold text-primary">
        {handicapIndex !== null ? handicapIndex.toFixed(1) : "—"}
      </span>
    </div>
  );

  const explanation = (
    <div className="space-y-3">
      <Muted>
        Your Handicap Index is calculated by averaging your best score
        differentials, based on how many rounds you have:
      </Muted>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>3 rounds: Best 1 (-2.0)</div>
        <div>4 rounds: Best 1 (-1.0)</div>
        <div>5 rounds: Best 1</div>
        <div>6 rounds: Best 2 (-1.0)</div>
        <div>7-8 rounds: Best 2</div>
        <div>9-11 rounds: Best 3</div>
        <div>12-14 rounds: Best 4</div>
        <div>15-16 rounds: Best 5</div>
        <div>17-18 rounds: Best 6</div>
        <div>19 rounds: Best 7</div>
        <div>20+ rounds: Best 8</div>
      </div>
      {handicapIndex !== null && (
        <div className="bg-muted/50 rounded-lg p-3">
          <P className="text-sm text-muted-foreground">
            Using {relevantDifferentials.length} of {differentials.length}{" "}
            differentials:
          </P>
          <P className="font-mono">
            ({relevantDifferentials.join(" + ")}) / {relevantDifferentials.length}
          </P>
          <P className="font-bold mt-1">= {handicapIndex.toFixed(1)}</P>
        </div>
      )}
    </div>
  );

  return (
    <CalculatorCard meta={meta} result={result} explanation={explanation}>
      <div className="space-y-4">
        <div className="flex gap-2">
          <div className="flex-1 space-y-2">
            <Label htmlFor="newDifferential">Add Score Differential</Label>
            <Input
              id="newDifferential"
              type="number"
              step="0.1"
              placeholder="e.g., 12.3"
              value={newDifferential}
              onChange={(e) => setNewDifferential(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addDifferential()}
            />
          </div>
          <Button
            onClick={addDifferential}
            className="self-end"
            disabled={!newDifferential}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {differentials.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {differentials.map((diff, index) => (
              <Badge
                key={index}
                variant={usedIndices.has(index) ? "default" : "secondary"}
                className="gap-1"
              >
                {diff.toFixed(1)}
                <button
                  onClick={() => removeDifferential(index)}
                  className="hover:bg-white/20 rounded-full p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}

        {differentials.length > 0 && differentials.length < 3 && (
          <Muted className="text-sm">
            Add at least 3 differentials to calculate your handicap index.
          </Muted>
        )}
      </div>
    </CalculatorCard>
  );
}
