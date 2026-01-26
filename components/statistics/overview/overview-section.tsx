"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { OverviewStats, CoursePerformance } from "@/types/statistics";

interface PerformanceSectionProps {
  stats: OverviewStats;
  bestCourse?: CoursePerformance;
}

export function PerformanceSection({ stats, bestCourse }: PerformanceSectionProps) {
  const formatDifferential = (diff: number) => diff.toFixed(1);

  const getImprovementMessage = (): string => {
    if (stats.improvementRate === 0) return "Keep playing to track improvement";
    if (stats.improvementRate > 0) {
      return `${stats.improvementRate.toFixed(1)}% improvement - keep it up!`;
    }
    return "Room for improvement";
  };

  const getAvgScoreContext = (): string => {
    // Assuming par 72 as standard
    const overPar = Math.round(stats.avgScore) - 72;
    if (overPar === 0) return "Right at par!";
    if (overPar > 0) return `Typically ${overPar} over par`;
    return `Typically ${Math.abs(overPar)} under par`;
  };

  return (
    <div className="space-y-6">
      {/* Highlight Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* Best Round */}
        <Card className="bg-gradient-to-br from-yellow-500/10 to-amber-500/10 border-yellow-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <span>🏆</span> Best Round
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {formatDifferential(stats.bestDifferential)}
            </p>
            <p className="text-sm text-muted-foreground">differential</p>
            {bestCourse && (
              <p className="text-xs text-muted-foreground mt-1">
                at {bestCourse.courseName}
              </p>
            )}
            <p className="text-xs text-green-600 font-medium mt-2">
              Your career best!
            </p>
          </CardContent>
        </Card>

        {/* Score Range */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <span>📊</span> Score Range
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-green-600">
                {formatDifferential(stats.bestDifferential)}
              </span>
              <span className="text-muted-foreground">to</span>
              <span className="text-3xl font-bold text-red-500">
                {formatDifferential(stats.worstDifferential)}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">differential range</p>
            <p className="text-xs text-muted-foreground mt-2">
              {(stats.worstDifferential - stats.bestDifferential).toFixed(1)} stroke spread
            </p>
          </CardContent>
        </Card>

        {/* Improvement */}
        <Card
          className={cn(
            stats.improvementRate > 0 &&
              "bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-500/20"
          )}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <span>{stats.improvementRate > 0 ? "📈" : "📉"}</span> Improvement
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <p
                className={cn(
                  "text-3xl font-bold",
                  stats.improvementRate > 0 ? "text-green-600" : "text-muted-foreground"
                )}
              >
                {stats.improvementRate > 0 ? "+" : ""}
                {stats.improvementRate.toFixed(1)}%
              </p>
            </div>
            <p className="text-sm text-muted-foreground">since starting</p>
            <p
              className={cn(
                "text-xs mt-2",
                stats.improvementRate > 0 ? "text-green-600 font-medium" : "text-muted-foreground"
              )}
            >
              {getImprovementMessage()}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Average Score</p>
            <p className="text-2xl font-bold">{Math.round(stats.avgScore)}</p>
            <p className="text-xs text-muted-foreground">{getAvgScoreContext()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Handicap Change</p>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-bold">
                {stats.handicapChange > 0 ? "+" : ""}
                {stats.handicapChange.toFixed(1)}
              </p>
              {stats.handicapChange !== 0 && (
                <span
                  className={cn(
                    "text-sm",
                    stats.handicapChange < 0 ? "text-green-600" : "text-red-500"
                  )}
                >
                  {stats.handicapChange < 0 ? "↓" : "↑"}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.handicapChange < 0 ? "Getting better!" : stats.handicapChange > 0 ? "Room to improve" : "Holding steady"}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Keep the old export for backward compatibility during migration
export { PerformanceSection as OverviewSection };
