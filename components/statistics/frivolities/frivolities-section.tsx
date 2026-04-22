"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { StatisticsSection } from "../shared/statistics-section";
import { FunStatCard } from "../fun-facts/fun-stat-card";
import { ScoreDistributionChart } from "../fun-facts/score-distribution-chart";
import { StrokesByDayChart } from "./strokes-by-day-chart";
import { FunComparisonsCard } from "./fun-comparisons-card";
import { cn } from "@/lib/utils";
import { StatTile } from "@/components/ui/stat-tile";
import {
  formatNumber,
  formatGolfAge,
  formatStrokesPerHole,
  formatDifferential,
} from "@/lib/statistics/format-utils";
import type { FunStats } from "@/types/statistics";

// World golf course count (approximate)
const WORLD_GOLF_COURSES = 38000;

interface FrivolitiesSectionProps {
  stats: FunStats;
}

export function FrivolitiesSection({ stats }: FrivolitiesSectionProps) {
  // Calculate total holes for context
  const totalHoles = stats.strokesByParType.reduce(
    (sum, parType) => sum + parType.holeCount,
    0
  );

  const strokesPerHole = formatStrokesPerHole(stats.avgStrokesPerHole);

  const hasNoData = stats.totalStrokes === 0;

  if (hasNoData) {
    return (
      <Card>
        <CardContent className="p-2xl text-center text-muted-foreground">
          <div className="text-4xl mb-md">🎮</div>
          <p className="text-lg font-medium">No stroke data yet</p>
          <p className="text-sm">Play some rounds to unlock fun statistics</p>
        </CardContent>
      </Card>
    );
  }

  // Calculate perfect holes percentage
  const perfectHolesPercentage =
    totalHoles > 0
      ? ((stats.perfectHoles.total / totalHoles) * 100).toFixed(1)
      : "0";

  // Calculate world courses percentage
  const worldCoursesPercentage =
    stats.uniqueCoursesPlayed > 0
      ? ((stats.uniqueCoursesPlayed / WORLD_GOLF_COURSES) * 100).toFixed(4)
      : "0";

  // Format total distance
  const formatDistance = (yards: number): string => {
    if (yards >= 1760) {
      const miles = yards / 1760;
      return `${miles.toFixed(1)} miles`;
    }
    return `${formatNumber(yards)} yards`;
  };

  const { holeByHoleStats, lunarPerformance } = stats;
  const { frontBackComparison, streakStats } = holeByHoleStats;

  return (
    <div className="space-y-xl">
      {/* Golf Odyssey Section */}
      <StatisticsSection
        icon="🎮"
        title="Your Golf Odyssey"
        description="A playful look at your golfing journey"
        learnMoreContent={
          <p>
            These are just-for-fun statistics! They represent the total strokes
            you&apos;ve taken across all your recorded rounds. While they don&apos;t
            affect your handicap, they&apos;re a fun way to see how much golf
            you&apos;ve been playing.
          </p>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-md">
          <FunStatCard
            title="Total Strokes"
            value={formatNumber(stats.totalStrokes)}
            emoji="🏌️"
            subtitle={`across ${formatNumber(totalHoles)} holes`}
          />
          <FunStatCard
            title="Golf Journey"
            value={formatGolfAge(stats.golfAgeDays)}
            emoji="📅"
            subtitle={`${formatNumber(stats.golfAgeDays)} days total`}
          />
          <FunStatCard
            title="Avg Strokes/Hole"
            value={strokesPerHole.display}
            emoji="⛳"
            subtitle={strokesPerHole.context}
          />
        </div>
      </StatisticsSection>

      <Separator />

      {/* Achievements Section */}
      <StatisticsSection
        icon="🏅"
        title="Achievements"
        description="Your notable golfing accomplishments"
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-md">
          <Card className="tint-score-eagle">
            <CardContent className="p-md">
              <StatTile
                value={stats.perfectHoles.eagles}
                label="Eagles"
                leading={<span className="text-2xl">🦅</span>}
              />
            </CardContent>
          </Card>
          <Card className="tint-score-birdie">
            <CardContent className="p-md">
              <StatTile
                value={stats.perfectHoles.birdies}
                label="Birdies"
                leading={<span className="text-2xl">🐦</span>}
              />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-md">
              <StatTile
                value={stats.perfectHoles.pars}
                label="Pars"
                leading={<span className="text-2xl">✓</span>}
              />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-md">
              <StatTile
                value={`${perfectHolesPercentage}%`}
                label="Par or Better"
                leading={<span className="text-2xl">🎯</span>}
              />
            </CardContent>
          </Card>
        </div>

        {stats.bogeyFreeRounds > 0 && (
          <Card className="mt-md tint-primary">
            <CardContent className="p-md">
              <div className="flex items-center gap-md">
                <div className="text-3xl">🌟</div>
                <div>
                  <p className="font-semibold">
                    {stats.bogeyFreeRounds} Bogey-Free Round
                    {stats.bogeyFreeRounds !== 1 ? "s" : ""}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Rounds where you scored par or better on every hole
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </StatisticsSection>

      <Separator />

      {/* Lunar Golf Section */}
      <StatisticsSection
        icon="🌙"
        title="Lunar Golf"
        description="Does the moon affect your game?"
        learnMoreContent={
          <p>
            Some golfers swear by the moon&apos;s influence on their game. We
            calculate the lunar phase for each of your rounds and track your
            average differential. Is it science or superstition? You decide!
          </p>
        }
      >
        <div className="space-y-md">
          {/* Best and Worst Phase Highlight */}
          {lunarPerformance.bestPhase && lunarPerformance.worstPhase && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
              <Card className="tint-info">
                <CardContent className="p-md">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Best Phase</p>
                      <p className="text-xl font-bold flex items-center gap-sm">
                        <span className="text-2xl">
                          {lunarPerformance.bestPhase.emoji}
                        </span>
                        {lunarPerformance.bestPhase.phaseName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {lunarPerformance.bestPhase.roundCount} round
                        {lunarPerformance.bestPhase.roundCount !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-success">
                        {formatDifferential(lunarPerformance.bestPhase.avgDifferential)}
                      </p>
                      <p className="text-xs text-muted-foreground">avg diff</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="tint-score-bogey">
                <CardContent className="p-md">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Challenging Phase
                      </p>
                      <p className="text-xl font-bold flex items-center gap-sm">
                        <span className="text-2xl">
                          {lunarPerformance.worstPhase.emoji}
                        </span>
                        {lunarPerformance.worstPhase.phaseName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {lunarPerformance.worstPhase.roundCount} round
                        {lunarPerformance.worstPhase.roundCount !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-warning">
                        {formatDifferential(lunarPerformance.worstPhase.avgDifferential)}
                      </p>
                      <p className="text-xs text-muted-foreground">avg diff</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* All Phases Grid */}
          <Card>
            <CardHeader className="pb-sm">
              <CardTitle className="text-base">All Lunar Phases</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 md:grid-cols-8 gap-sm">
                {lunarPerformance.phaseStats.map((phase) => (
                  <div
                    key={phase.phase}
                    className={cn(
                      "text-center p-sm rounded-lg",
                      phase.roundCount > 0 ? "bg-muted/50" : "opacity-40"
                    )}
                  >
                    <div className="text-2xl">{phase.emoji}</div>
                    <p className="text-xs font-medium truncate">{phase.phaseName}</p>
                    <p className="text-xs text-muted-foreground">
                      {phase.roundCount > 0
                        ? formatDifferential(phase.avgDifferential)
                        : "--"}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {phase.roundCount} rnd{phase.roundCount !== 1 ? "s" : ""}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </StatisticsSection>

      <Separator />

      {/* Front 9 vs Back 9 & Fun Numbers */}
      <StatisticsSection
        icon="🔢"
        title="Fun Numbers"
        description="Quirky stats about your game"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-lg">
          {/* Front 9 vs Back 9 */}
          <Card>
            <CardHeader className="pb-sm">
              <CardTitle className="text-base">Front 9 vs Back 9</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center gap-xl py-md">
                <StatTile
                  value={
                    <span
                      className={cn(
                        frontBackComparison.betterHalf === "front" && "text-success"
                      )}
                    >
                      {frontBackComparison.front9.avgOverPar >= 0 ? "+" : ""}
                      {frontBackComparison.front9.avgOverPar.toFixed(2)}
                    </span>
                  }
                  label="avg over par"
                  leading={<p className="text-sm text-muted-foreground">Front 9</p>}
                  size="lg"
                />
                <div className="text-2xl text-muted-foreground">vs</div>
                <StatTile
                  value={
                    <span
                      className={cn(
                        frontBackComparison.betterHalf === "back" && "text-success"
                      )}
                    >
                      {frontBackComparison.back9.avgOverPar >= 0 ? "+" : ""}
                      {frontBackComparison.back9.avgOverPar.toFixed(2)}
                    </span>
                  }
                  label="avg over par"
                  leading={<p className="text-sm text-muted-foreground">Back 9</p>}
                  size="lg"
                />
              </div>
              {frontBackComparison.betterHalf !== "even" && (
                <p className="text-center text-sm text-muted-foreground">
                  You play the{" "}
                  <span className="font-medium text-foreground">
                    {frontBackComparison.betterHalf === "front" ? "front" : "back"} 9
                  </span>{" "}
                  better by {frontBackComparison.difference.toFixed(2)} strokes/hole
                </p>
              )}
            </CardContent>
          </Card>

          {/* Lucky Numbers */}
          <Card>
            <CardHeader className="pb-sm">
              <CardTitle className="text-base">Your Lucky Numbers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-md py-sm">
                <div className="text-center surface-muted p-sm">
                  <p className="text-sm text-muted-foreground">Lucky Number</p>
                  <p className="text-4xl font-bold text-primary">
                    {holeByHoleStats.luckyNumber ?? "--"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    most common hole score
                  </p>
                </div>
                <div className="text-center surface-muted p-sm">
                  <p className="text-sm text-muted-foreground">Signature Score</p>
                  <p className="text-4xl font-bold text-primary">
                    {holeByHoleStats.signatureScore ?? "--"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    most common round total
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Streak Records */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-md mt-md">
          <Card className="tint-score-birdie">
            <CardContent className="p-md">
              <StatTile
                value={streakStats.longestParStreak}
                label="Longest Par Streak"
                hint="holes at par or better"
                leading={<span className="text-2xl">🔥</span>}
              />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-md">
              <StatTile
                value={streakStats.averageParStreak.toFixed(1)}
                label="Avg Par Streak"
                hint="consecutive holes"
                leading={<span className="text-2xl">📊</span>}
              />
            </CardContent>
          </Card>
          <Card className="tint-score-bogey">
            <CardContent className="p-md">
              <StatTile
                value={streakStats.longestBogeyStreak}
                label="Longest Bogey Streak"
                hint="holes at bogey+"
                leading={<span className="text-2xl">💀</span>}
              />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-md">
              <StatTile
                value={stats.uniqueHolesPlayed}
                label="Unique Holes"
                hint={<>holes you&apos;ve played</>}
                leading={<span className="text-2xl">🎯</span>}
              />
            </CardContent>
          </Card>
        </div>
      </StatisticsSection>

      <Separator />

      {/* Global Golf Section */}
      <StatisticsSection
        icon="🌍"
        title="Global Golf"
        description="Your worldwide golfing footprint"
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-md">
          <Card className="tint-info">
            <CardContent className="p-md">
              <StatTile
                value={stats.uniqueCoursesPlayed}
                label="Courses Played"
                hint={`${worldCoursesPercentage}% of world's ~${formatNumber(WORLD_GOLF_COURSES)} courses`}
                leading={<span className="text-3xl">🏌️</span>}
                size="lg"
              />
            </CardContent>
          </Card>
          <Card className="tint-success">
            <CardContent className="p-md">
              <StatTile
                value={stats.countriesPlayed}
                label="Countries Visited"
                hint={`${((stats.countriesPlayed / 195) * 100).toFixed(1)}% of world's nations`}
                leading={<span className="text-3xl">🌐</span>}
                size="lg"
              />
            </CardContent>
          </Card>
          <Card className="tint-primary">
            <CardContent className="p-md">
              <StatTile
                value={formatDistance(holeByHoleStats.totalDistancePlayed)}
                label="Total Distance"
                hint="walked to every shot"
                leading={<span className="text-3xl">📏</span>}
                size="lg"
              />
            </CardContent>
          </Card>
        </div>
      </StatisticsSection>

      <Separator />

      {/* Stroke Census Section */}
      <StatisticsSection
        icon="📊"
        title="Stroke Census"
        description="How your strokes break down by score type"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-lg">
          {/* Score Distribution */}
          <Card>
            <CardHeader className="pb-sm">
              <CardTitle className="text-base">Score Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <ScoreDistributionChart data={stats.scoreDistribution} />
            </CardContent>
          </Card>

          {/* Strokes by Par Type */}
          <Card>
            <CardHeader className="pb-sm">
              <CardTitle className="text-base">Strokes by Par Type</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-md py-sm">
                {stats.strokesByParType.map((parType) => {
                  const overPar = parType.avgStrokes - parType.parType;
                  const total = stats.strokesByParType.reduce(
                    (sum, p) => sum + p.totalStrokes,
                    0
                  );
                  const percentage =
                    total > 0 ? (parType.totalStrokes / total) * 100 : 0;

                  return (
                    <div key={parType.parType} className="space-y-sm">
                      <div className="flex justify-between items-center">
                        <div>
                          <span className="font-medium">Par {parType.parType}</span>
                          <span className="text-muted-foreground text-sm ml-sm">
                            ({parType.holeCount} holes)
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="font-bold">
                            {parType.avgStrokes.toFixed(2)}
                          </span>
                          <span className="text-muted-foreground text-sm ml-xs">
                            avg ({overPar > 0 ? "+" : ""}
                            {overPar.toFixed(1)})
                          </span>
                        </div>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </StatisticsSection>

      <Separator />

      {/* Day of Destruction Section */}
      <StatisticsSection
        icon="💥"
        title="Day of Destruction"
        description="Which day do you hit the most strokes?"
      >
        <Card>
          <CardContent className="pt-6">
            <StrokesByDayChart data={stats.strokesByDayOfWeek} />
          </CardContent>
        </Card>
      </StatisticsSection>

      <Separator />

      {/* Fun Comparisons Section */}
      <StatisticsSection
        icon="🎪"
        title="Fun Comparisons"
        description="Creative ways to visualize your golf effort"
      >
        <FunComparisonsCard
          totalStrokes={stats.totalStrokes}
          totalHoles={totalHoles}
          golfAgeDays={stats.golfAgeDays}
          totalDistancePlayed={holeByHoleStats.totalDistancePlayed}
          uniqueCourses={stats.uniqueCoursesPlayed}
        />
      </StatisticsSection>
    </div>
  );
}
