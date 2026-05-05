"use client";

import { useRoundCalculationContext } from "@/contexts/roundCalculationContext";
import { Muted } from "@/components/ui/typography";
import { StatTile } from "@/components/ui/stat-tile";
import { cn } from "@/lib/utils";
import { useState, useEffect, useRef } from "react";

interface ScoreDistributionSidebarProps {
  layout?: "vertical" | "horizontal";
  compact?: boolean;
}

const ScoreDistributionSidebar = ({ layout = "vertical", compact = false }: ScoreDistributionSidebarProps) => {
  const { scorecard, apsStat, isNineHoles } = useRoundCalculationContext();
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          // Add slight delay for staggered effect with table
          timeoutId = setTimeout(() => setIsVisible(true), 150);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => {
      observer.disconnect();
      clearTimeout(timeoutId);
    };
  }, []);

  const scores = scorecard.scores;
  const holes = scorecard.teePlayed?.holes;
  const playedHoles = holes?.slice(0, scores.length) ?? [];
  const allHoles = holes ?? [];

  // Round summary calculations
  const totalStrokes = scores.reduce((acc, s) => acc + s.strokes, 0);
  const totalPar = playedHoles.reduce((acc, h) => acc + h.par, 0);
  const toPar = totalStrokes - totalPar;

  // Calculate distribution relative to par
  const distribution: Record<string, { count: number; label: string; color: string }> = {
    "-2": { count: 0, label: "Eagle-", color: "bg-score-eagle" },
    "-1": { count: 0, label: "Birdie", color: "bg-score-birdie" },
    "0": { count: 0, label: "Par", color: "bg-score-par" },
    "1": { count: 0, label: "Bogey", color: "bg-score-bogey" },
    "2": { count: 0, label: "Double", color: "bg-score-double" },
    "3+": { count: 0, label: "Triple+", color: "bg-score-triple" },
  };

  playedHoles.forEach((hole, index) => {
    const score = scores[index];
    if (!score) return;
    const diff = score.strokes - hole.par;
    if (diff <= -2) distribution["-2"].count++;
    else if (diff === -1) distribution["-1"].count++;
    else if (diff === 0) distribution["0"].count++;
    else if (diff === 1) distribution["1"].count++;
    else if (diff === 2) distribution["2"].count++;
    else distribution["3+"].count++;
  });

  const maxCount = Math.max(...Object.values(distribution).map(d => d.count), 1);
  const totalPlayedHoles = playedHoles.length;

  // Guard: don't render stats if no holes have been played
  if (totalPlayedHoles === 0) {
    return null;
  }

  // Calculate hole-by-hole mini visualization (show all 18 holes)
  const holeScores = allHoles.map((hole, index) => {
    const score = scores[index];
    // No score for this hole (unplayed in 9-hole round)
    if (!score) {
      return { hole: hole.holeNumber, diff: null, color: "bg-muted/50 border border-dashed border-muted-foreground/30" };
    }
    const diff = score.strokes - hole.par;
    let color = "bg-score-par";
    if (diff <= -2) color = "bg-score-eagle";
    else if (diff === -1) color = "bg-score-birdie";
    else if (diff === 1) color = "bg-score-bogey";
    else if (diff === 2) color = "bg-score-double";
    else if (diff >= 3) color = "bg-score-triple";
    return { hole: hole.holeNumber, diff, color };
  });

  // Shared section components
  const roundSummarySection = (
    <div className="surface-muted p-md h-full">
      <Muted className="text-xs uppercase tracking-wide mb-sm">Round Summary</Muted>
      <div className="grid grid-cols-2 gap-sm">
        <StatTile value={totalStrokes} label="Gross Score" />
        <StatTile
          value={
            <span
              className={cn(
                toPar < 0 && "text-success",
                toPar > 0 && "text-destructive"
              )}
            >
              {toPar === 0 ? "E" : toPar > 0 ? `+${toPar}` : toPar}
            </span>
          }
          label="To Par"
        />
        <StatTile value={apsStat} label="Adjusted" />
        <StatTile
          value={Number(scorecard.round.scoreDifferential).toFixed(1)}
          label="Differential"
        />
      </div>
    </div>
  );

  const scoreDistributionSection = (
    <div className="surface-muted p-md h-full">
      <Muted className="text-xs uppercase tracking-wide mb-sm">Score Distribution</Muted>
      <div className="space-y-sm">
        {Object.entries(distribution).map(([key, { count, label, color }]) => (
          <div key={key} className="flex items-center gap-sm text-sm">
            <span className="w-14 text-right text-muted-foreground">{label}</span>
            <div className="flex-1 h-5 bg-muted rounded overflow-hidden">
              <div
                className={cn("h-full rounded transition-all", color)}
                style={{ width: `${(count / maxCount) * 100}%` }}
              />
            </div>
            <span className="w-6 text-right font-medium">{count}</span>
          </div>
        ))}
      </div>
    </div>
  );

  const holeByHoleSection = (
    <div className="surface-muted p-md h-full">
      <Muted className="text-xs uppercase tracking-wide mb-sm">Hole-by-Hole</Muted>
      <div className="grid grid-cols-9 gap-xs">
        {holeScores.map(({ hole, diff, color }) => (
          <div
            key={hole}
            className={cn(
              "aspect-square rounded flex items-center justify-center text-xs font-medium",
              diff !== null ? "text-white" : "text-muted-foreground",
              color
            )}
            title={diff !== null ? `Hole ${hole}: ${diff === 0 ? "E" : diff > 0 ? `+${diff}` : diff}` : `Hole ${hole}: Not played`}
          >
            {hole}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-sm mt-sm text-xs">
        <div className="flex items-center gap-xs">
          <div className="w-3 h-3 rounded bg-score-eagle" />
          <span>Eagle-</span>
        </div>
        <div className="flex items-center gap-xs">
          <div className="w-3 h-3 rounded bg-score-birdie" />
          <span>Birdie</span>
        </div>
        <div className="flex items-center gap-xs">
          <div className="w-3 h-3 rounded bg-score-par" />
          <span>Par</span>
        </div>
        <div className="flex items-center gap-xs">
          <div className="w-3 h-3 rounded bg-score-bogey" />
          <span>Bogey</span>
        </div>
        <div className="flex items-center gap-xs">
          <div className="w-3 h-3 rounded bg-score-double" />
          <span>Double+</span>
        </div>
        {isNineHoles && (
          <div className="flex items-center gap-xs">
            <div className="w-3 h-3 rounded bg-muted/50 border border-dashed border-muted-foreground/30" />
            <span>Not played</span>
          </div>
        )}
      </div>
    </div>
  );

  const quickStatsSection = (
    <div className="surface-muted p-md h-full">
      <Muted className="text-xs uppercase tracking-wide mb-sm">Quick Stats</Muted>
      <div className="grid grid-cols-2 gap-sm text-sm">
        <div>
          <div className="font-semibold">
            {((distribution["0"].count + distribution["-1"].count + distribution["-2"].count) / totalPlayedHoles * 100).toFixed(0)}%
          </div>
          <Muted className="text-xs">Par or better</Muted>
        </div>
        <div>
          <div className="font-semibold">
            {((distribution["2"].count + distribution["3+"].count) / totalPlayedHoles * 100).toFixed(0)}%
          </div>
          <Muted className="text-xs">Double+</Muted>
        </div>
        <div>
          <div className="font-semibold">
            {(totalStrokes / totalPlayedHoles).toFixed(1)}
          </div>
          <Muted className="text-xs">Avg per hole</Muted>
        </div>
        <div>
          <div className="font-semibold">
            {(totalPar / totalPlayedHoles).toFixed(1)}
          </div>
          <Muted className="text-xs">Avg par</Muted>
        </div>
      </div>
    </div>
  );

  if (layout === "horizontal") {
    return (
      <div
        ref={ref}
        className={cn(
          "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-md transition-all duration-500",
          isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
        )}
      >
        {roundSummarySection}
        {scoreDistributionSection}
        {holeByHoleSection}
        {quickStatsSection}
      </div>
    );
  }

  // Compact mode for 9-hole rounds - combine sections to match shorter table height
  if (compact) {
    return (
      <div
        ref={ref}
        className={cn(
          "space-y-md transition-all duration-500",
          isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
        )}
      >
        {/* Combined Summary & Stats */}
        <div className="surface-muted p-md">
          <Muted className="text-xs uppercase tracking-wide mb-sm">Round Summary</Muted>
          <div className="grid grid-cols-4 gap-sm">
            <StatTile size="sm" value={totalStrokes} label="Gross" />
            <StatTile
              size="sm"
              value={
                <span
                  className={cn(
                    toPar < 0 && "text-success",
                    toPar > 0 && "text-destructive"
                  )}
                >
                  {toPar === 0 ? "E" : toPar > 0 ? `+${toPar}` : toPar}
                </span>
              }
              label="To Par"
            />
            <StatTile size="sm" value={apsStat} label="Adj." />
            <StatTile
              size="sm"
              value={Number(scorecard.round.scoreDifferential).toFixed(1)}
              label="Diff."
            />
          </div>
        </div>

        {/* Score Distribution - compact */}
        <div className="surface-muted p-md">
          <Muted className="text-xs uppercase tracking-wide mb-sm">Score Distribution</Muted>
          <div className="space-y-xs">
            {Object.entries(distribution).map(([key, { count, label, color }]) => (
              <div key={key} className="flex items-center gap-sm text-xs">
                <span className="w-12 text-right text-muted-foreground">{label}</span>
                <div className="flex-1 h-4 bg-muted rounded overflow-hidden">
                  <div
                    className={cn("h-full rounded transition-all", color)}
                    style={{ width: `${(count / maxCount) * 100}%` }}
                  />
                </div>
                <span className="w-4 text-right font-medium">{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Stats - inline */}
        <div className="surface-muted p-md">
          <div className="grid grid-cols-4 gap-sm text-center text-sm">
            <div>
              <div className="font-semibold">
                {((distribution["0"].count + distribution["-1"].count + distribution["-2"].count) / totalPlayedHoles * 100).toFixed(0)}%
              </div>
              <Muted className="text-xs">Par+</Muted>
            </div>
            <div>
              <div className="font-semibold">
                {((distribution["2"].count + distribution["3+"].count) / totalPlayedHoles * 100).toFixed(0)}%
              </div>
              <Muted className="text-xs">Dbl+</Muted>
            </div>
            <div>
              <div className="font-semibold">
                {(totalStrokes / totalPlayedHoles).toFixed(1)}
              </div>
              <Muted className="text-xs">Avg</Muted>
            </div>
            <div>
              <div className="font-semibold">
                {(totalPar / totalPlayedHoles).toFixed(1)}
              </div>
              <Muted className="text-xs">Par</Muted>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className={cn(
        "space-y-md transition-all duration-500",
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      )}
    >
      {roundSummarySection}
      {scoreDistributionSection}
      {holeByHoleSection}
      {quickStatsSection}
    </div>
  );
};

export default ScoreDistributionSidebar;
