/**
 * Home — native twin of apps/web/app/page.tsx (the AUTHENTICATED homepage;
 * decision ledger: mobile apps don't ship marketing landers — logged-out
 * users land on /login via the tabs layout). Web fetches server-side; native
 * runs the same tRPC procedures through TanStack Query. Web's charts section
 * is desktop-only (`hidden md:block`) and therefore absent on the phone
 * reference and here.
 */
import { useQueries, useQuery } from "@tanstack/react-query";
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { tokens } from "@handicappin/tokens/tokens";

import { ActivityFeed } from "@/components/homepage/activity-feed";
import { HandicapGoal } from "@/components/homepage/handicap-goal";
import { Hero } from "@/components/homepage/hero";
import { QuickActions } from "@/components/homepage/quick-actions";
import { QuickStats } from "@/components/homepage/quick-stats";
import { DataSettledMarker } from "@/components/data-settled";
import { profileQueryOptions } from "@/lib/api/procedures/auth";
import { courseByIdQueryOptions, teeByIdQueryOptions } from "@/lib/api/procedures/course";
import {
  bestRoundQueryOptions,
  roundCountQueryOptions,
  roundsQueryOptions,
} from "@/lib/api/procedures/round";
import { useUserId } from "@/lib/auth/session-provider";
import { transformRoundsToActivities } from "@/lib/activity-transform";
import { HOMEPAGE_ROUNDS_LIMIT } from "@/lib/golf-stats";
import { useDataSettled } from "@/lib/query/settle";

export default function HomeScreen() {
  const userId = useUserId();
  const insets = useSafeAreaInsets();

  const profileQuery = useQuery({
    ...profileQueryOptions(userId ?? ""),
    enabled: userId != null,
  });
  const roundsQuery = useQuery({
    ...roundsQueryOptions(userId ?? "", HOMEPAGE_ROUNDS_LIMIT),
    enabled: userId != null,
  });
  const bestRoundQuery = useQuery({
    ...bestRoundQueryOptions(userId ?? ""),
    enabled: userId != null,
  });
  const totalRoundsQuery = useQuery({
    ...roundCountQueryOptions(userId ?? ""),
    enabled: userId != null,
  });

  const rounds = roundsQuery.data ?? [];
  const bestRound = bestRoundQuery.data ?? null;

  const courseIds = [...new Set(rounds.map((r) => r.courseId))];
  const courseQueries = useQueries({
    queries: courseIds.map((courseId) => courseByIdQueryOptions(courseId)),
  });
  const bestRoundTeeQuery = useQuery({
    ...teeByIdQueryOptions(bestRound?.teeId ?? 0),
    enabled: bestRound != null,
  });

  const settled = useDataSettled([
    profileQuery,
    roundsQuery,
    bestRoundQuery,
    totalRoundsQuery,
  ]);

  const profile = profileQuery.data;

  if (!profile) {
    // Profile still loading (or errored): keep the frame stable for capture.
    return (
      <View
        testID="home-screen"
        className="flex-1 bg-background items-center justify-center"
      >
        <DataSettledMarker settled={settled && profileQuery.isError} />
        <Text className="text-body text-muted-foreground">
          {profileQuery.isError ? "Could not load your profile" : "Loading…"}
        </Text>
      </View>
    );
  }

  const sortedRounds = [...rounds].sort((a, b) => {
    const timeComparison =
      new Date(a.teeTime).getTime() - new Date(b.teeTime).getTime();
    if (timeComparison !== 0) return timeComparison;
    return a.id - b.id;
  });

  const previousScores = sortedRounds
    .slice(-10)
    .map((round) => round.scoreDifferential);

  const percentageChange =
    profile.initialHandicapIndex !== 0
      ? Number(
          (
            (profile.handicapIndex - profile.initialHandicapIndex) /
            Math.abs(profile.initialHandicapIndex)
          ).toFixed(2),
        )
      : 0;

  const lowestDifferential =
    rounds.length > 0
      ? Math.min(...rounds.map((r) => r.scoreDifferential))
      : null;

  const courseMap = new Map<number, string>();
  courseQueries.forEach((query, i) => {
    const courseId = courseIds[i];
    if (query.data && courseId !== undefined) {
      courseMap.set(courseId, query.data.name);
    }
  });

  const activities = transformRoundsToActivities(
    rounds,
    courseMap,
    totalRoundsQuery.data,
  );

  let bestRoundCourseName: string | undefined;
  if (bestRound) {
    bestRoundCourseName = courseMap.get(bestRound.courseId);
  }

  return (
    <ScrollView
      testID="home-screen"
      className="flex-1 bg-background"
      contentContainerStyle={{
        paddingTop: insets.top,
        paddingBottom: tokens.spacing["2xl"],
      }}
    >
      <DataSettledMarker settled={settled} />

      <Hero
        profile={profile}
        previousScores={previousScores}
        initialHandicapIndex={profile.initialHandicapIndex}
        bestRound={bestRound}
        bestRoundTee={bestRoundTeeQuery.data ?? null}
        bestRoundCourseName={bestRoundCourseName}
        handicapPercentageChange={percentageChange}
      />

      {/* Activity + side stack (single column on phone, like web's mobile layout) */}
      <View
        style={{
          paddingHorizontal: tokens.spacing.md,
          paddingVertical: tokens.spacing.xl,
          gap: tokens.spacing.lg,
        }}
      >
        <ActivityFeed activities={activities} profileId={profile.id} />
        <View className="gap-md">
          <QuickActions userId={profile.id} />
          <HandicapGoal
            currentHandicap={profile.handicapIndex}
            startingHandicap={profile.initialHandicapIndex}
          />
          <QuickStats
            activities={activities}
            lowestDifferential={lowestDifferential}
            bestRoundDate={bestRound ? new Date(bestRound.teeTime) : null}
          />
        </View>
      </View>
    </ScrollView>
  );
}
