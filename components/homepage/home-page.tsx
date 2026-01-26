import { Tables } from "@/types/supabase";
import { api } from "@/trpc/server";
import Hero from "./hero";
import { ActivityFeed } from "./activity-feed";
import { QuickActions } from "./quick-actions";
import { QuickStats } from "./quick-stats";
import { HandicapGoal } from "./handicap-goal";
import HandicapTrendChartDisplay from "../charts/lazy-handicap-trend-chart-display";
import ScoreBarChartDisplay from "../charts/lazy-score-bar-chart-display";
import { getRelevantRounds } from "@/lib/handicap";
import { transformRoundsToActivities } from "@/utils/activity-transform";
import { HOMEPAGE_ROUNDS_LIMIT } from "@/utils/golf-stats";

interface HomepageProps {
  profile: Tables<"profile">;
}

export const HomePage = async ({ profile }: HomepageProps) => {
  const { id, handicapIndex, initialHandicapIndex } = profile;

  // Fetch all data in parallel
  const [rounds, bestRound, totalRounds] = await Promise.all([
    api.round.getAllByUserId({ userId: id, amount: HOMEPAGE_ROUNDS_LIMIT }),
    api.round.getBestRound({ userId: id }),
    api.round.getCountByUserId({ userId: id }),
  ]);

  // Process data for charts and activity feed
  const sortedRounds = [...rounds].sort((a, b) => {
    const timeComparison =
      new Date(a.teeTime).getTime() - new Date(b.teeTime).getTime();
    if (timeComparison !== 0) return timeComparison;
    return a.id - b.id;
  });

  const relevantRoundsList = getRelevantRounds(sortedRounds);

  const previousHandicaps = sortedRounds.slice(-10).map((round) => ({
    key: `${round.id}`,
    roundDate: new Date(round.teeTime).toLocaleDateString(),
    roundTime: new Date(round.teeTime).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }),
    handicap: round.updatedHandicapIndex,
  }));

  const previousScores = sortedRounds.slice(-10).map((round) => ({
    key: `${round.id}`,
    roundDate: new Date(round.teeTime).toLocaleDateString(),
    roundTime: new Date(round.teeTime).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }),
    score: round.scoreDifferential,
    influencesHcp: relevantRoundsList.includes(round),
  }));

  // Use initialHandicapIndex as baseline for "since first round" calculations
  // This matches what HandicapGoal displays and provides a consistent baseline
  const percentageChange =
    initialHandicapIndex !== null && initialHandicapIndex !== 0
      ? Number(
          (
            (handicapIndex - initialHandicapIndex) /
            Math.abs(initialHandicapIndex)
          ).toFixed(2)
        )
      : 0;

  // Calculate lowest differential for QuickStats
  const lowestDifferential =
    rounds.length > 0
      ? Math.min(...rounds.map((r) => r.scoreDifferential))
      : null;

  // Fetch course info for best round and activity feed
  let bestRoundCourse: Tables<"course"> | null = null;
  let bestRoundTee: Tables<"teeInfo"> | null = null;
  const courseMap = new Map<number, string>();

  if (rounds.length > 0) {
    // Fetch course data for activity feed - use allSettled for graceful degradation
    const courseIds = [...new Set(rounds.map((r) => r.courseId))];
    const coursesResults = await Promise.allSettled(
      courseIds.map((courseId) => api.course.getCourseById({ courseId }))
    );
    coursesResults.forEach((result, i) => {
      if (result.status === "fulfilled" && result.value) {
        courseMap.set(courseIds[i], result.value.name);
      }
    });
  }

  if (bestRound) {
    const [courseResult, teeResult] = await Promise.allSettled([
      api.course.getCourseById({ courseId: bestRound.courseId }),
      api.tee.getTeeById({ teeId: bestRound.teeId }),
    ]);
    bestRoundCourse =
      courseResult.status === "fulfilled" ? courseResult.value : null;
    bestRoundTee = teeResult.status === "fulfilled" ? teeResult.value : null;
  }

  // Transform data for activity feed (pass totalRounds for accurate milestone calculation)
  const activities = transformRoundsToActivities(rounds, courseMap, totalRounds);

  return (
    <div className="flex flex-col min-h-screen">
      <main className="flex-1">
        {/* Hero Section */}
        <section className="w-full relative overflow-hidden">
          {/* Premium gradient background with brand colors */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-accent/20 to-background" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,oklch(0.46_0.16_148_/_0.12),transparent)]" />
          <div className="absolute top-0 right-0 w-1/3 h-full bg-gradient-to-l from-accent/10 to-transparent" />
          {/* Content */}
          <div className="relative">
            <Hero
              profile={profile}
              previousScores={previousScores.map((s) => s.score)}
              initialHandicapIndex={initialHandicapIndex}
              bestRound={bestRound}
              bestRoundTee={bestRoundTee}
              bestRoundCourseName={bestRoundCourse?.name}
              handicapPercentageChange={percentageChange}
            />
          </div>
        </section>

        {/* Activity Feed Section */}
        <section className="w-full py-8 lg:py-12">
          <div className="container px-4 lg:px-6">
            <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
              <ActivityFeed activities={activities} profileId={profile.id} />
              <div className="space-y-4">
                <QuickActions userId={profile.id} className="lg:grid-cols-2" />
                <HandicapGoal
                  currentHandicap={handicapIndex}
                  startingHandicap={initialHandicapIndex}
                />
                <QuickStats
                  activities={activities}
                  lowestDifferential={lowestDifferential}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Charts Section - Desktop only */}
        <section className="hidden md:block w-full py-8 lg:py-12 bg-muted/30">
          <div className="container px-4 lg:px-6">
            <h2 className="text-xl font-semibold mb-6">Performance Analytics</h2>
            <div className="grid gap-6 xl:grid-cols-2">
              <HandicapTrendChartDisplay
                handicapIndex={handicapIndex}
                percentageChange={percentageChange}
                previousHandicaps={previousHandicaps}
                profile={profile}
              />
              <ScoreBarChartDisplay
                previousScores={previousScores}
                profile={profile}
              />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};
