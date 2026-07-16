"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { StatDelta } from "@/components/ui/stat-delta";
import { cn } from "@/lib/utils";
import { StatisticsSection } from "../shared/statistics-section";
import { getFlagEmoji } from "@/utils/frivolities/headerGenerator";
import {
  formatDecimal,
  formatDifferential,
  formatPercentage,
  formatSampleSize,
  formatScore,
  formatWithSign,
  isValidNumber,
} from "@/lib/statistics/format-utils";
import type {
  OverviewStats,
  CoursePerformance,
  PerformanceExtendedStats,
  ShotLevelStats,
  ShotStat,
} from "@/types/statistics";

interface PerformanceSectionProps {
  stats: OverviewStats;
  extendedStats: PerformanceExtendedStats;
  shotLevelStats: ShotLevelStats;
  bestCourse?: CoursePerformance;
}

/** "Based on N of M rounds" subtitle for a shot-level stat card (D6). */
const basedOn = (stat: ShotStat, totalRounds: number): string =>
  formatSampleSize(stat.sampleSize, totalRounds);

export function PerformanceSection({
  stats,
  extendedStats,
  shotLevelStats,
  bestCourse,
}: PerformanceSectionProps) {
  const getImprovementMessage = (): string => {
    if (!isValidNumber(stats.improvementRate) || stats.improvementRate === 0) {
      return "Keep playing to track improvement";
    }
    if (stats.improvementRate > 0) {
      return `${stats.improvementRate.toFixed(1)}% improvement - keep it up!`;
    }
    return "Room for improvement";
  };

  const getAvgScoreContext = (): string => {
    if (stats.totalRounds === 0) return "No data yet";
    if (!isValidNumber(stats.avgScore)) return "No data yet";
    if (!isValidNumber(stats.avgPar)) return `across ${stats.totalRounds} round${stats.totalRounds !== 1 ? "s" : ""}`;
    const overPar = Math.round(stats.avgScore) - Math.round(stats.avgPar);
    if (overPar === 0) return "Right at par!";
    if (overPar > 0) return `Typically ${overPar} over par`;
    return `Typically ${Math.abs(overPar)} under par`;
  };

  const getStrokeSpread = (): string => {
    if (
      !isValidNumber(stats.worstDifferential) ||
      !isValidNumber(stats.bestDifferential)
    ) {
      return "--";
    }
    return (stats.worstDifferential - stats.bestDifferential).toFixed(1);
  };

  const getHandicapChangeMessage = (): string => {
    if (stats.totalRounds === 0) return "No data yet";
    if (!isValidNumber(stats.handicapChange)) return "No data yet";
    if (stats.handicapChange < 0) return "Getting better!";
    if (stats.handicapChange > 0) return "Room to improve";
    return "Holding steady";
  };

  const getConsistencyLabel = (rating: number): string => {
    if (rating >= 80) return "Very Consistent";
    if (rating >= 60) return "Consistent";
    if (rating >= 40) return "Moderate";
    if (rating >= 20) return "Variable";
    return "Unpredictable";
  };


  return (
    <div className="space-y-xl">
      {/* Highlights Section */}
      <StatisticsSection
        icon="🏆"
        title="Highlights"
        description="Your standout performance metrics"
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-md">
          {/* Best Round */}
          <Card className="tint-score-eagle">
            <CardHeader className="pb-sm">
              <CardTitle className="text-body-sm text-muted-foreground flex items-center gap-sm">
                <span>🏆</span> Best Round
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-figure-lg">
                {formatDifferential(stats.bestDifferential)}
              </p>
              <p className="text-body-sm text-muted-foreground">differential</p>
              {bestCourse && (
                <p className="text-meta text-muted-foreground mt-xs">
                  at {bestCourse.courseName}
                </p>
              )}
              <p className="text-meta-strong text-success mt-sm">
                Your career best!
              </p>
            </CardContent>
          </Card>

          {/* Score Range */}
          <Card>
            <CardHeader className="pb-sm">
              <CardTitle className="text-body-sm text-muted-foreground flex items-center gap-sm">
                <span>📊</span> Score Range
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-sm">
                <span className="text-figure-lg text-success">
                  {formatDifferential(stats.bestDifferential)}
                </span>
                <span className="text-muted-foreground">to</span>
                <span className="text-figure-lg text-destructive">
                  {formatDifferential(stats.worstDifferential)}
                </span>
              </div>
              <p className="text-body-sm text-muted-foreground">differential range</p>
              <p className="text-meta text-muted-foreground mt-sm">
                {getStrokeSpread()} stroke spread
              </p>
            </CardContent>
          </Card>

          {/* Improvement */}
          <Card
            className={cn(
              isValidNumber(stats.improvementRate) &&
              stats.improvementRate > 0 &&
              "tint-success"
            )}
          >
            <CardHeader className="pb-sm">
              <CardTitle className="text-body-sm text-muted-foreground flex items-center gap-sm">
                <span>
                  {!isValidNumber(stats.improvementRate) || stats.improvementRate === 0
                    ? "📊"
                    : stats.improvementRate > 0
                      ? "📈"
                      : "📉"}
                </span>{" "}
                Improvement
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-sm">
                <p
                  className={cn(
                    "text-figure-lg",
                    isValidNumber(stats.improvementRate) && stats.improvementRate > 0
                      ? "text-success"
                      : "text-muted-foreground"
                  )}
                >
                  {isValidNumber(stats.improvementRate)
                    ? `${stats.improvementRate > 0 ? "+" : ""}${stats.improvementRate.toFixed(1)}%`
                    : "--"}
                </p>
              </div>
              <p className="text-body-sm text-muted-foreground">since starting</p>
              <p
                className={cn(
                  "text-meta mt-sm",
                  isValidNumber(stats.improvementRate) && stats.improvementRate > 0
                    ? "text-success font-medium"
                    : "text-muted-foreground"
                )}
              >
                {getImprovementMessage()}
              </p>
            </CardContent>
          </Card>
        </div>
      </StatisticsSection>

      <Separator />

      {/* Overview Stats Section */}
      <StatisticsSection
        icon="📈"
        title="Overview Stats"
        description="Key metrics at a glance"
      >
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-md">
          <Card>
            <CardContent density="compact">
              <p className="text-body-sm text-muted-foreground">Average Score</p>
              <p className="text-figure">{formatScore(stats.avgScore)}</p>
              <p className="text-meta text-muted-foreground">{getAvgScoreContext()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent density="compact">
              <p className="text-body-sm text-muted-foreground">Handicap Change</p>
              <div className="flex items-baseline gap-sm">
                <p className="text-figure">
                  {formatWithSign(stats.handicapChange)}
                </p>
                {isValidNumber(stats.handicapChange) && stats.handicapChange !== 0 && (
                  <StatDelta
                    value={stats.handicapChange}
                    invert
                    iconOnly
                    className="text-body-sm"
                  />
                )}
              </div>
              <p className="text-meta text-muted-foreground">
                {getHandicapChangeMessage()}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent density="compact">
              <p className="text-body-sm text-muted-foreground">Consistency</p>
              <p className="text-figure">
                {extendedStats.consistencyRating > 0
                  ? `${extendedStats.consistencyRating}%`
                  : "--"}
              </p>
              <p className="text-meta text-muted-foreground">
                {extendedStats.consistencyRating > 0
                  ? getConsistencyLabel(extendedStats.consistencyRating)
                  : "Need more rounds"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent density="compact">
              <p className="text-body-sm text-muted-foreground">Courses Played</p>
              <p className="text-figure">{extendedStats.uniqueCourses}</p>
              <p className="text-meta text-muted-foreground">
                unique course{extendedStats.uniqueCourses !== 1 ? "s" : ""}
              </p>
            </CardContent>
          </Card>
        </div>
      </StatisticsSection>

      <Separator />

      {/* Shot-Level Stats Section (plans/010) */}
      <StatisticsSection
        icon="🎯"
        title="Shot-Level Stats"
        description="Putts, fairways, and penalties from detailed scoring"
      >
        {shotLevelStats.puttsPerRound.sampleSize > 0 ||
        shotLevelStats.girPercentage.sampleSize > 0 ||
        shotLevelStats.firPercentage.sampleSize > 0 ||
        shotLevelStats.penaltiesPerRound.sampleSize > 0 ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-md">
            <Card>
              <CardContent density="compact">
                <p className="text-body-sm text-muted-foreground">
                  Putts / Round
                </p>
                <p className="text-figure">
                  {formatDecimal(shotLevelStats.puttsPerRound.value, 1)}
                </p>
                <p className="text-meta text-muted-foreground">
                  {basedOn(shotLevelStats.puttsPerRound, stats.totalRounds)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent density="compact">
                <p className="text-body-sm text-muted-foreground">GIR</p>
                <p className="text-figure">
                  {formatPercentage(shotLevelStats.girPercentage.value)}
                </p>
                <p className="text-meta text-muted-foreground">
                  {basedOn(shotLevelStats.girPercentage, stats.totalRounds)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent density="compact">
                <p className="text-body-sm text-muted-foreground">
                  Fairways Hit
                </p>
                <p className="text-figure">
                  {formatPercentage(shotLevelStats.firPercentage.value)}
                </p>
                <p className="text-meta text-muted-foreground">
                  {basedOn(shotLevelStats.firPercentage, stats.totalRounds)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent density="compact">
                <p className="text-body-sm text-muted-foreground">
                  Penalties / Round
                </p>
                <p className="text-figure">
                  {formatDecimal(shotLevelStats.penaltiesPerRound.value, 1)}
                </p>
                <p className="text-meta text-muted-foreground">
                  {basedOn(shotLevelStats.penaltiesPerRound, stats.totalRounds)}
                </p>
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card>
            <CardContent density="compact">
              <p className="text-body-sm text-muted-foreground">
                No shot-level data yet. Choose{" "}
                <span className="font-medium text-foreground">
                  Track detailed stats
                </span>{" "}
                when logging a round to track putts, greens in regulation,
                fairways, and penalties.
              </p>
            </CardContent>
          </Card>
        )}
        {/* The anti-skew reassurance (plan 013 D6). */}
        <p className="text-meta text-muted-foreground mt-md">
          Your handicap uses{" "}
          <span className="font-medium text-foreground">every</span> round.
          Detailed stats only use rounds where you logged them — nothing you
          skip counts against you.
        </p>
      </StatisticsSection>

      {/* Best Month Section (if available) */}
      {extendedStats.bestMonth && (
        <>
          <Separator />
          <StatisticsSection
            icon="🌟"
            title="Best Month"
            description="Your peak performance period"
          >
            <Card className="tint-primary">
              <CardContent className="p-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-figure">
                      {extendedStats.bestMonth.month} {extendedStats.bestMonth.year}
                    </p>
                    <p className="text-body-sm text-muted-foreground">
                      {extendedStats.bestMonth.roundCount} rounds played
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-figure-lg text-success">
                      {formatDifferential(extendedStats.bestMonth.avgDifferential)}
                    </p>
                    <p className="text-body-sm text-muted-foreground">avg differential</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </StatisticsSection>
        </>
      )}

      {/* Exceptional Rounds Section (if any) */}
      {extendedStats.exceptionalRounds.length > 0 && (
        <>
          <Separator />
          <StatisticsSection
            icon="⚡"
            title="Exceptional Rounds"
            description={`You've had ${extendedStats.exceptionalRounds.length} exceptional round${extendedStats.exceptionalRounds.length !== 1 ? "s" : ""}!`}
            learnMoreContent={
              <p>
                An exceptional round is when your score differential is 7 or more
                strokes better than your handicap index at the time. These rounds
                trigger an Exceptional Score Reduction (ESR) in the USGA handicap
                system, which helps prevent rapid handicap drops from single
                outstanding performances.
              </p>
            }
          >
            <div className="space-y-sm">
              {extendedStats.exceptionalRounds.map((round) => (
                <Link
                  key={round.roundId}
                  href={`/rounds/${round.roundId}/calculation`}
                  className="block"
                >
                  <Card className="tint-score-eagle hover:border-score-eagle/40 transition-colors cursor-pointer">
                    <CardContent density="compact">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-sm">
                          <div className="text-figure">🏆</div>
                          <div>
                            <p className="font-semibold">
                              {getFlagEmoji(round.country)} {round.courseName}
                            </p>
                            <p className="text-body-sm text-muted-foreground">
                              {new Date(round.date).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-figure text-success">
                            {formatDifferential(round.differential)}
                          </p>
                          <p className="text-meta text-muted-foreground">
                            -{round.adjustment.toFixed(1)} ESR applied
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </StatisticsSection>
        </>
      )}
    </div>
  );
}

// Keep the old export for backward compatibility during migration
export { PerformanceSection as OverviewSection };
