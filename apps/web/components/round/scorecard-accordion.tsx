"use client";

/**
 * Read-only scorecard viewer (plan 013 D2): separated hole cards that
 * expand in place. Header shows Par · SI · Distance; expanding reveals the
 * static Putts / Fairway / Penalties trio. Holes logged without detail
 * render score-only, non-expandable cards — never empty stat chips.
 * Mirrored at apps/native/components/round-calculation/scorecard-accordion.tsx.
 */
import { ChevronRight } from "lucide-react";
import { useState } from "react";

import { HoleDetailTrio } from "@/components/scorecard/hole-detail-trio";
import { holeHasDetail, scoreResultLabel } from "@/lib/scorecard/hole-detail";
import { Hole, Score, ScorecardWithRound } from "@/types/scorecard-input";
import { cn } from "@/lib/utils";

function HoleCard({
  hole,
  score,
  unit,
}: {
  hole: Hole;
  score: Score;
  unit: "m" | "yd";
}) {
  const [open, setOpen] = useState(false);
  const expandable = holeHasDetail(score);
  const diff = score.strokes - hole.par;
  const resultClass =
    diff < 0 ? "text-success" : diff > 0 ? "text-warning" : "text-foreground";

  const header = (
    <>
      <span className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background-alternate text-body-sm font-medium tabular-nums">
        {hole.holeNumber}
      </span>
      <span className="flex-1 text-left">
        <span className="block text-body-sm font-medium">Par {hole.par}</span>
        <span className="block text-meta text-muted-foreground tabular-nums">
          SI {hole.hcp} · {hole.distance} {unit}
        </span>
      </span>
      <span className="text-right">
        <span className={cn("block text-body font-bold tabular-nums", resultClass)}>
          {score.strokes}
        </span>
        <span className={cn("block text-meta", resultClass)}>
          {scoreResultLabel(score.strokes, hole.par)}
        </span>
      </span>
      {expandable && (
        <ChevronRight
          aria-hidden
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform",
            open && "rotate-90"
          )}
        />
      )}
    </>
  );

  if (!expandable) {
    return (
      <div className="flex items-center gap-md rounded-lg border bg-background px-md py-sm">
        {header}
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-background">
      <button
        type="button"
        className="flex w-full items-center gap-md px-md py-sm"
        aria-expanded={open}
        aria-label={`Hole ${hole.holeNumber} details`}
        onClick={() => setOpen((v) => !v)}
      >
        {header}
      </button>
      {open && (
        <div className="border-t px-md py-sm">
          <HoleDetailTrio
            mode="static"
            holeNumber={hole.holeNumber}
            par={hole.par}
            value={{
              putts: score.putts,
              fairwayHit: score.fairwayHit,
              penaltyStrokes: score.penaltyStrokes,
            }}
          />
        </div>
      )}
    </div>
  );
}

/** Strokes / avg-putts / vs-par rollup for a run of played holes. */
function sectionStats(holes: Hole[], scoreFor: (h: Hole) => Score | undefined) {
  let strokes = 0;
  let par = 0;
  let puttsSum = 0;
  let puttsCount = 0;
  for (const hole of holes) {
    const score = scoreFor(hole);
    if (!score) continue;
    strokes += score.strokes;
    par += hole.par;
    if (score.putts != null) {
      puttsSum += score.putts;
      puttsCount += 1;
    }
  }
  const diff = strokes - par;
  return {
    strokes,
    avgPutts: puttsCount > 0 ? (puttsSum / puttsCount).toFixed(1) : "–",
    toPar: diff === 0 ? "E" : diff > 0 ? `+${diff}` : `${diff}`,
  };
}

/** OUT / IN / TOTAL rollup row rendered after each nine's hole cards. */
function SummaryRow({
  label,
  stats,
}: {
  label: string;
  stats: ReturnType<typeof sectionStats>;
}) {
  return (
    <div className="flex items-center gap-md rounded-lg border bg-background-alternate px-md py-sm">
      <span className="flex h-8 min-w-8 items-center justify-center text-label-sm uppercase text-muted-foreground">
        {label}
      </span>
      {(
        [
          ["Strokes", String(stats.strokes)],
          ["Avg putts", stats.avgPutts],
          ["Score", stats.toPar],
        ] as const
      ).map(([caption, value]) => (
        <span key={caption} className="flex-1 text-center">
          <span className="block text-meta text-muted-foreground">
            {caption}
          </span>
          <span className="block text-body-sm font-bold tabular-nums">
            {value}
          </span>
        </span>
      ))}
    </div>
  );
}

export function ScorecardAccordion({
  scorecard,
}: {
  scorecard: ScorecardWithRound;
}) {
  const allHoles = scorecard.teePlayed.holes ?? [];
  const unit =
    scorecard.teePlayed.distanceMeasurement === "meters" ? "m" : "yd";

  // holeId → score lookup: works for front-9, back-9 and 18-hole rounds
  // alike (same pattern as HolesTable).
  const scoresByHoleId = new Map<number, Score>();
  for (const s of scorecard.scores) {
    if (s.holeId !== undefined) scoresByHoleId.set(s.holeId, s);
  }
  const playedHoles = allHoles.filter(
    (h) => h.id !== undefined && scoresByHoleId.has(h.id)
  );
  const scoreFor = (h: Hole) => scoresByHoleId.get(h.id ?? -1);

  const front = playedHoles.filter((h) => h.holeNumber <= 9);
  const back = playedHoles.filter((h) => h.holeNumber > 9);
  const bothNines = front.length > 0 && back.length > 0;

  const section = (label: string, summaryLabel: string, holes: Hole[]) =>
    holes.length > 0 && (
      <div className="space-y-sm">
        <div className="px-xs">
          <span className="text-label-sm uppercase text-muted-foreground">
            {label}
          </span>
        </div>
        {holes.map((hole) => {
          const score = scoreFor(hole);
          if (!score) return null;
          return (
            <HoleCard
              key={hole.holeNumber}
              hole={hole}
              score={score}
              unit={unit}
            />
          );
        })}
        <SummaryRow
          label={summaryLabel}
          stats={sectionStats(holes, scoreFor)}
        />
      </div>
    );

  return (
    <div className="space-y-md">
      {section("Front 9", "Out", front)}
      {section("Back 9", "In", back)}
      {bothNines && (
        <SummaryRow
          label="Total"
          stats={sectionStats(playedHoles, scoreFor)}
        />
      )}
    </div>
  );
}

export default ScorecardAccordion;
