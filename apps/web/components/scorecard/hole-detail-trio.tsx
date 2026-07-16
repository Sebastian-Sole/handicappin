"use client";

/**
 * The Putts / Fairway / Penalties trio (plan 013 D7) — built once, used in
 * two modes:
 *  - "editable": steppers + segmented fairway, for the one-hole-at-a-time
 *    logging UI (post-round and live).
 *  - "static": read-only chips, for the saved-round viewer accordion.
 * Mirrored at apps/native/components/scorecard/hole-detail-trio.tsx.
 */
import { Minus, Plus } from "lucide-react";

import {
  fairwayGlyph,
  fairwayLabel,
  maxPenaltiesForStrokes,
  maxPuttsForStrokes,
  stepDetailCount,
  toggleFairway,
  type HoleDetailValue,
} from "@/lib/scorecard/hole-detail";
import { cn } from "@/lib/utils";

interface HoleDetailTrioProps {
  mode: "editable" | "static";
  holeNumber: number;
  par: number;
  value: HoleDetailValue;
  /**
   * Editable mode: the hole's current strokes — caps the steppers so
   * putts + penalties never exceed strokes − 1 (null/unset = uncapped).
   */
  strokes?: number | null;
  disabled?: boolean;
  /** Editable mode: emits a patch for the changed field (undefined clears). */
  onChange?: (detail: HoleDetailValue) => void;
}

function CountStepper({
  label,
  fieldLabel,
  holeNumber,
  value,
  max,
  disabled,
  onStep,
}: {
  label: string;
  fieldLabel: string;
  holeNumber: number;
  value: number | null | undefined;
  max: number;
  disabled?: boolean;
  onStep: (next: number | undefined) => void;
}) {
  return (
    <div className="flex items-center overflow-hidden rounded-md border border-border">
      <button
        type="button"
        className="flex h-10 w-11 items-center justify-center bg-muted text-foreground hover:bg-accent disabled:opacity-40"
        disabled={disabled || value == null}
        aria-label={`One less ${fieldLabel} for hole ${holeNumber}`}
        onClick={() => onStep(stepDetailCount(value, -1, max))}
      >
        <Minus className="h-4 w-4" aria-hidden />
      </button>
      <span
        className="flex-1 text-center text-body font-medium tabular-nums"
        aria-label={`${label} for hole ${holeNumber}: ${value ?? "not set"}`}
      >
        {value ?? "–"}
      </span>
      <button
        type="button"
        className="flex h-10 w-11 items-center justify-center bg-muted text-foreground hover:bg-accent disabled:opacity-40"
        disabled={disabled || (value ?? 0) >= max}
        aria-label={`One more ${fieldLabel} for hole ${holeNumber}`}
        onClick={() => onStep(stepDetailCount(value, 1, max))}
      >
        <Plus className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}

function FairwaySegment({
  holeNumber,
  par,
  value,
  disabled,
  onChange,
}: {
  holeNumber: number;
  par: number;
  value: boolean | null | undefined;
  disabled?: boolean;
  onChange: (next: boolean | undefined) => void;
}) {
  const isPar3 = par === 3;
  if (isPar3) {
    return (
      <div
        className="flex h-10 items-center justify-center rounded-md border border-dashed border-border text-body-sm text-muted-foreground"
        aria-label={`Fairway hole ${holeNumber}: not applicable (par 3)`}
      >
        N/A (par 3)
      </div>
    );
  }
  return (
    <div className="flex gap-sm" role="group" aria-label={`Fairway hole ${holeNumber}`}>
      <button
        type="button"
        aria-pressed={value === true}
        aria-label={`Fairway hit, hole ${holeNumber}: ${fairwayLabel(value, false)}`}
        disabled={disabled}
        className={cn(
          "h-10 flex-1 rounded-md border border-border text-label-sm text-muted-foreground disabled:opacity-40",
          value === true
            ? "border-success bg-success text-success-foreground"
            : "hover:border-success"
        )}
        onClick={() => onChange(toggleFairway(value, "hit"))}
      >
        Hit
      </button>
      <button
        type="button"
        aria-pressed={value === false}
        aria-label={`Fairway missed, hole ${holeNumber}: ${fairwayLabel(value, false)}`}
        disabled={disabled}
        className={cn(
          "h-10 flex-1 rounded-md border border-border text-label-sm text-muted-foreground disabled:opacity-40",
          value === false
            ? "border-destructive bg-destructive text-destructive-foreground"
            : "hover:border-destructive"
        )}
        onClick={() => onChange(toggleFairway(value, "miss"))}
      >
        Miss
      </button>
    </div>
  );
}

function StaticChip({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="flex-1 rounded-md border border-border bg-background-alternate px-sm py-sm text-center">
      <div className="text-meta text-muted-foreground">{label}</div>
      <div className={cn("text-body font-medium tabular-nums", className)}>
        {children}
      </div>
    </div>
  );
}

export function HoleDetailTrio({
  mode,
  holeNumber,
  par,
  value,
  strokes,
  disabled,
  onChange,
}: HoleDetailTrioProps) {
  if (mode === "static") {
    const penalties = value.penaltyStrokes;
    return (
      <div className="flex gap-sm">
        <StaticChip label="Putts">{value.putts ?? "–"}</StaticChip>
        <StaticChip
          label="Fairway"
          className={cn(
            value.fairwayHit === true && par !== 3 && "text-success",
            value.fairwayHit === false && par !== 3 && "text-destructive",
            (par === 3 || value.fairwayHit == null) && "text-muted-foreground"
          )}
        >
          {fairwayGlyph(value.fairwayHit, par === 3)}
        </StaticChip>
        <StaticChip
          label="Penalties"
          className={cn(penalties != null && penalties > 0 && "text-warning")}
        >
          {penalties ?? "–"}
        </StaticChip>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-sm">
      <div className="grid grid-cols-[5rem_1fr] items-center gap-sm">
        <span className="text-label-sm text-muted-foreground">Putts</span>
        <CountStepper
          label="Putts"
          fieldLabel="putt"
          holeNumber={holeNumber}
          value={value.putts}
          max={maxPuttsForStrokes(strokes, value.penaltyStrokes)}
          disabled={disabled}
          onStep={(putts) => onChange?.({ putts })}
        />
      </div>
      <div className="grid grid-cols-[5rem_1fr] items-center gap-sm">
        <span className="text-label-sm text-muted-foreground">Fairway</span>
        <FairwaySegment
          holeNumber={holeNumber}
          par={par}
          value={value.fairwayHit}
          disabled={disabled}
          onChange={(fairwayHit) => onChange?.({ fairwayHit })}
        />
      </div>
      <div className="grid grid-cols-[5rem_1fr] items-center gap-sm">
        <span className="text-label-sm text-muted-foreground">Penalties</span>
        <CountStepper
          label="Penalties"
          fieldLabel="penalty stroke"
          holeNumber={holeNumber}
          value={value.penaltyStrokes}
          max={maxPenaltiesForStrokes(strokes, value.putts)}
          disabled={disabled}
          onStep={(penaltyStrokes) => onChange?.({ penaltyStrokes })}
        />
      </div>
    </div>
  );
}
