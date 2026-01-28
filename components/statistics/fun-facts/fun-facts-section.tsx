"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FunStatCard } from "./fun-stat-card";
import { ScoreDistributionChart } from "./score-distribution-chart";
import { formatNumber, formatGolfAge } from "@/lib/statistics/format-utils";
import type { FunStats } from "@/types/statistics";

interface ScoringBreakdownSectionProps {
  stats: FunStats;
}

export function ScoringBreakdownSection({ stats }: ScoringBreakdownSectionProps) {

  // Calculate total holes and weighted average par from actual data
  const totalHoles = stats.strokesByParType.reduce(
    (sum, parType) => sum + parType.holeCount,
    0
  );

  const weightedParSum = stats.strokesByParType.reduce(
    (sum, parType) => sum + parType.parType * parType.holeCount,
    0
  );

  const averagePar = totalHoles > 0 ? weightedParSum / totalHoles : 4;

  // Calculate avg over par using weighted average
  const avgOverPar = stats.avgStrokesPerHole - averagePar;

  return (
    <div className="space-y-6">
      {/* Milestone Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <FunStatCard
          title="Total Strokes"
          value={formatNumber(stats.totalStrokes)}
          emoji="🏌️"
          subtitle={`across ${formatNumber(totalHoles)} holes`}
        />
        <FunStatCard
          title="Avg Strokes/Hole"
          value={stats.avgStrokesPerHole.toFixed(2)}
          emoji="⛳"
          subtitle={
            avgOverPar > 0
              ? `${avgOverPar.toFixed(1)} over par avg`
              : avgOverPar < 0
                ? `${Math.abs(avgOverPar).toFixed(1)} under par avg`
                : "Right at par!"
          }
        />
        <FunStatCard
          title="Golf Journey"
          value={formatGolfAge(stats.golfAgeDays)}
          emoji="📅"
          subtitle={`${formatNumber(stats.golfAgeDays)} days total`}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Strokes by Par Type */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Strokes by Par Type</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats.strokesByParType.map((parType) => {
                const overPar = parType.avgStrokes - parType.parType;
                return (
                  <div
                    key={parType.parType}
                    className="flex items-center justify-between"
                  >
                    <span className="font-medium">Par {parType.parType}</span>
                    <div className="text-right">
                      <span className="text-lg font-bold">
                        {parType.avgStrokes.toFixed(2)}
                      </span>
                      <span className="text-muted-foreground text-sm ml-2">
                        avg ({overPar > 0 ? "+" : ""}
                        {overPar.toFixed(1)})
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Score Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Score Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ScoreDistributionChart data={stats.scoreDistribution} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Keep old export for backward compatibility
export { ScoringBreakdownSection as FunFactsSection };
