"use client";

/**
 * One-hole-at-a-time scorecard entry (plan 013 D1) — THE phone logging UI.
 * Hole meta, a prominent score stepper, and (when the round is detailed)
 * the shared Putts / Fairway / Penalties trio, paged with Prev / Next.
 * Mirrored at apps/native/components/scorecard/hole-entry-pager.tsx.
 */
import { Minus, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { HoleDetailTrio } from "@/components/scorecard/hole-detail-trio";
import {
  HOLE_IN_ONE_CELEBRATION_MS,
  HoleInOneCelebration,
} from "@/components/scorecard/hole-in-one-celebration";
import type { HoleDetailValue } from "@/lib/scorecard/hole-detail";
import { Hole, Score, Tee } from "@/types/scorecard-input";
import { cn } from "@/lib/utils";

export const MIN_ENTRY_STROKES = 1;
export const MAX_ENTRY_STROKES = 30;

/**
 * Step a hole's strokes with the big stepper. Unset (0) seeds par on the
 * first interaction — one tap logs the most common score — then adjusts.
 */
export function stepStrokes(
  current: number,
  delta: 1 | -1,
  par: number
): number {
  if (current <= 0) return par;
  return Math.min(
    MAX_ENTRY_STROKES,
    Math.max(MIN_ENTRY_STROKES, current + delta)
  );
}

interface HoleEntryPagerProps {
  selectedTee: Tee | undefined;
  displayedHoles: Hole[];
  holeCount: number;
  scores: Score[];
  onScoreChange: (holeIndex: number, strokes: number) => void;
  disabled: boolean;
  detailedScoring?: boolean;
  onScoreDetailChange?: (holeIndex: number, detail: HoleDetailValue) => void;
}

export function HoleEntryPager({
  selectedTee,
  displayedHoles,
  holeCount,
  scores,
  onScoreChange,
  disabled,
  detailedScoring = false,
  onScoreDetailChange,
}: HoleEntryPagerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  // Hole-in-one guard: a score of 1 asks for confirmation on Next (an
  // accidental ace is far more common than a real one), then celebrates.
  const [aceConfirmOpen, setAceConfirmOpen] = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const confirmedAces = useRef<Set<number>>(new Set());
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
    };
  }, []);
  // Hole count can change under a live pager (18 → 9 switch).
  const index = Math.min(currentIndex, holeCount - 1);
  const hole = displayedHoles[index];
  const score = scores[index];
  const strokes = score?.strokes ?? 0;
  const unit = selectedTee?.distanceMeasurement === "meters" ? "m" : "yd";

  if (!hole) return null;

  const diff = strokes > 0 ? strokes - hole.par : null;

  const goNext = () => setCurrentIndex((i) => Math.min(holeCount - 1, i + 1));

  const handleNext = () => {
    // Data entry can put a 1 down by accident — confirm before moving on
    // (once per hole; browsing back and forth doesn't nag).
    if (!disabled && strokes === 1 && !confirmedAces.current.has(index)) {
      setAceConfirmOpen(true);
      return;
    }
    goNext();
  };

  const confirmAce = () => {
    confirmedAces.current.add(index);
    setAceConfirmOpen(false);
    setCelebrating(true);
    advanceTimer.current = setTimeout(goNext, HOLE_IN_ONE_CELEBRATION_MS);
  };

  return (
    <div className="rounded-lg border bg-background p-md space-y-md">
      <div className="flex items-baseline justify-between">
        <span className="text-label-sm text-muted-foreground">
          Hole {index + 1} of {holeCount}
        </span>
        <span className="text-meta text-muted-foreground">
          {scores
            .slice(0, holeCount)
            .filter((s) => s.strokes > 0)
            .length}{" "}
          scored
        </span>
      </div>

      {/* Progress: one segment per hole (done / current / todo). */}
      <div className="flex gap-xs" aria-hidden>
        {displayedHoles.map((_, i) => (
          <span
            key={i}
            className={cn(
              "h-1 flex-1 rounded-full",
              i === index
                ? "bg-primary"
                : (scores[i]?.strokes ?? 0) > 0
                  ? "bg-success"
                  : "bg-muted"
            )}
          />
        ))}
      </div>

      <div className="text-center space-y-xs">
        <p className="text-body-sm text-muted-foreground">
          Hole {index + 1} · Par {hole.par} · {hole.distance} {unit} · SI{" "}
          {hole.hcp}
        </p>
        <div className="flex items-center justify-center gap-lg">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-12 w-12 rounded-full"
            disabled={disabled || (strokes > 0 && strokes <= MIN_ENTRY_STROKES)}
            aria-label={`One stroke less on hole ${index + 1}`}
            onClick={() => onScoreChange(index, stepStrokes(strokes, -1, hole.par))}
          >
            <Minus className="h-5 w-5" aria-hidden />
          </Button>
          <div
            className="min-w-20 text-center"
            aria-label={`Score for hole ${index + 1}: ${
              strokes > 0 ? strokes : "not set"
            }`}
          >
            <span
              className={cn(
                "text-figure tabular-nums",
                strokes === 0 && "text-muted-foreground"
              )}
            >
              {strokes > 0 ? strokes : "—"}
            </span>
            <p className="text-meta text-muted-foreground">
              {/* Read-only surfaces disable the steppers — don't instruct
                  the user to tap a dead control. */}
              {diff === null
                ? disabled
                  ? "Not scored"
                  : "Tap + to score"
                : diff === 0
                  ? "Par"
                  : diff > 0
                    ? `+${diff}`
                    : `${diff}`}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-12 w-12 rounded-full"
            disabled={disabled || strokes >= MAX_ENTRY_STROKES}
            aria-label={`One stroke more on hole ${index + 1}`}
            onClick={() => onScoreChange(index, stepStrokes(strokes, 1, hole.par))}
          >
            <Plus className="h-5 w-5" aria-hidden />
          </Button>
        </div>
      </div>

      {detailedScoring && (
        <HoleDetailTrio
          mode="editable"
          holeNumber={index + 1}
          par={hole.par}
          value={{
            putts: score?.putts,
            fairwayHit: score?.fairwayHit,
            penaltyStrokes: score?.penaltyStrokes,
          }}
          strokes={strokes > 0 ? strokes : null}
          disabled={disabled}
          onChange={(detail) => onScoreDetailChange?.(index, detail)}
        />
      )}

      {/* Paging stays available while inputs are disabled — browsing a
          read-only scorecard is navigation, not data entry. */}
      <div className="flex gap-sm">
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          disabled={index === 0}
          onClick={() => setCurrentIndex(Math.max(0, index - 1))}
        >
          ← Prev
        </Button>
        <Button
          type="button"
          className="flex-1"
          disabled={index >= holeCount - 1}
          onClick={handleNext}
        >
          Next →
        </Button>
      </div>

      <Dialog open={aceConfirmOpen} onOpenChange={setAceConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Hole in one?</DialogTitle>
            <DialogDescription>
              You just logged a hole in one on hole {index + 1} — was this
              correct?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-sm">
            <Button
              type="button"
              variant="outline"
              onClick={() => setAceConfirmOpen(false)}
            >
              Change
            </Button>
            <Button type="button" onClick={confirmAce}>
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <HoleInOneCelebration
        visible={celebrating}
        onDone={() => setCelebrating(false)}
      />
    </div>
  );
}
