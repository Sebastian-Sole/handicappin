"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { StatisticsSection } from "../shared/statistics-section";
import { FunStatCard } from "../fun-facts/fun-stat-card";
import { ScoreDistributionChart } from "../fun-facts/score-distribution-chart";
import { StrokesByDayChart } from "./strokes-by-day-chart";
import { FunComparisonsCard } from "./fun-comparisons-card";
import { cn } from "@/lib/utils";
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
        <CardContent className="p-12 text-center text-muted-foreground">
          <div className="text-4xl mb-4">🎮</div>
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
    <div className="space-y-8">
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-yellow-500/10 to-amber-500/10 border-yellow-500/20">
            <CardContent className="p-4 text-center">
              <div className="text-2xl mb-1">🦅</div>
              <p className="text-2xl font-bold">{stats.perfectHoles.eagles}</p>
              <p className="text-sm text-muted-foreground">Eagles</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-500/20">
            <CardContent className="p-4 text-center">
              <div className="text-2xl mb-1">🐦</div>
              <p className="text-2xl font-bold">{stats.perfectHoles.birdies}</p>
              <p className="text-sm text-muted-foreground">Birdies</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl mb-1">✓</div>
              <p className="text-2xl font-bold">{stats.perfectHoles.pars}</p>
              <p className="text-sm text-muted-foreground">Pars</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl mb-1">🎯</div>
              <p className="text-2xl font-bold">{perfectHolesPercentage}%</p>
              <p className="text-sm text-muted-foreground">Par or Better</p>
            </CardContent>
          </Card>
        </div>

        {stats.bogeyFreeRounds > 0 && (
          <Card className="mt-4 bg-gradient-to-r from-purple-500/10 to-pink-500/10 border-purple-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
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
        <div className="space-y-4">
          {/* Best and Worst Phase Highlight */}
          {lunarPerformance.bestPhase && lunarPerformance.worstPhase && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border-indigo-500/20">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Best Phase</p>
                      <p className="text-xl font-bold flex items-center gap-2">
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
                      <p className="text-2xl font-bold text-green-600">
                        {formatDifferential(lunarPerformance.bestPhase.avgDifferential)}
                      </p>
                      <p className="text-xs text-muted-foreground">avg diff</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-orange-500/10 to-red-500/10 border-orange-500/20">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Challenging Phase
                      </p>
                      <p className="text-xl font-bold flex items-center gap-2">
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
                      <p className="text-2xl font-bold text-orange-600">
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
            <CardHeader className="pb-2">
              <CardTitle className="text-base">All Lunar Phases</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
                {lunarPerformance.phaseStats.map((phase) => (
                  <div
                    key={phase.phase}
                    className={cn(
                      "text-center p-2 rounded-lg",
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Front 9 vs Back 9 */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Front 9 vs Back 9</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center gap-8 py-4">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Front 9</p>
                  <p
                    className={cn(
                      "text-3xl font-bold",
                      frontBackComparison.betterHalf === "front" && "text-green-600"
                    )}
                  >
                    {frontBackComparison.front9.avgOverPar >= 0 ? "+" : ""}
                    {frontBackComparison.front9.avgOverPar.toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground">avg over par</p>
                </div>
                <div className="text-2xl text-muted-foreground">vs</div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Back 9</p>
                  <p
                    className={cn(
                      "text-3xl font-bold",
                      frontBackComparison.betterHalf === "back" && "text-green-600"
                    )}
                  >
                    {frontBackComparison.back9.avgOverPar >= 0 ? "+" : ""}
                    {frontBackComparison.back9.avgOverPar.toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground">avg over par</p>
                </div>
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
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Your Lucky Numbers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 py-2">
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">Lucky Number</p>
                  <p className="text-4xl font-bold text-primary">
                    {holeByHoleStats.luckyNumber ?? "--"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    most common hole score
                  </p>
                </div>
                <div className="text-center p-3 bg-muted/50 rounded-lg">
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
          <Card className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-500/20">
            <CardContent className="p-4 text-center">
              <div className="text-2xl mb-1">🔥</div>
              <p className="text-2xl font-bold">{streakStats.longestParStreak}</p>
              <p className="text-sm text-muted-foreground">Longest Par Streak</p>
              <p className="text-xs text-muted-foreground">holes at par or better</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl mb-1">📊</div>
              <p className="text-2xl font-bold">
                {streakStats.averageParStreak.toFixed(1)}
              </p>
              <p className="text-sm text-muted-foreground">Avg Par Streak</p>
              <p className="text-xs text-muted-foreground">consecutive holes</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-orange-500/10 to-red-500/10 border-orange-500/20">
            <CardContent className="p-4 text-center">
              <div className="text-2xl mb-1">💀</div>
              <p className="text-2xl font-bold">{streakStats.longestBogeyStreak}</p>
              <p className="text-sm text-muted-foreground">Longest Bogey Streak</p>
              <p className="text-xs text-muted-foreground">holes at bogey+</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl mb-1">🎯</div>
              <p className="text-2xl font-bold">{stats.uniqueHolesPlayed}</p>
              <p className="text-sm text-muted-foreground">Unique Holes</p>
              <p className="text-xs text-muted-foreground">holes you&apos;ve played</p>
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border-blue-500/20">
            <CardContent className="p-4 text-center">
              <div className="text-3xl mb-2">🏌️</div>
              <p className="text-3xl font-bold">{stats.uniqueCoursesPlayed}</p>
              <p className="text-sm text-muted-foreground">Courses Played</p>
              <p className="text-xs text-muted-foreground mt-1">
                {worldCoursesPercentage}% of world&apos;s ~{formatNumber(WORLD_GOLF_COURSES)}{" "}
                courses
              </p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-green-500/10 to-teal-500/10 border-green-500/20">
            <CardContent className="p-4 text-center">
              <div className="text-3xl mb-2">🌐</div>
              <p className="text-3xl font-bold">{stats.countriesPlayed}</p>
              <p className="text-sm text-muted-foreground">Countries Visited</p>
              <p className="text-xs text-muted-foreground mt-1">
                {((stats.countriesPlayed / 195) * 100).toFixed(1)}% of world&apos;s
                nations
              </p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-purple-500/20">
            <CardContent className="p-4 text-center">
              <div className="text-3xl mb-2">📏</div>
              <p className="text-3xl font-bold">
                {formatDistance(holeByHoleStats.totalDistancePlayed)}
              </p>
              <p className="text-sm text-muted-foreground">Total Distance</p>
              <p className="text-xs text-muted-foreground mt-1">
                walked to every shot
              </p>
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Score Distribution */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Score Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <ScoreDistributionChart data={stats.scoreDistribution} />
            </CardContent>
          </Card>

          {/* Strokes by Par Type */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Strokes by Par Type</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 py-2">
                {stats.strokesByParType.map((parType) => {
                  const overPar = parType.avgStrokes - parType.parType;
                  const total = stats.strokesByParType.reduce(
                    (sum, p) => sum + p.totalStrokes,
                    0
                  );
                  const percentage =
                    total > 0 ? (parType.totalStrokes / total) * 100 : 0;

                  return (
                    <div key={parType.parType} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <div>
                          <span className="font-medium">Par {parType.parType}</span>
                          <span className="text-muted-foreground text-sm ml-2">
                            ({parType.holeCount} holes)
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="font-bold">
                            {parType.avgStrokes.toFixed(2)}
                          </span>
                          <span className="text-muted-foreground text-sm ml-1">
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
