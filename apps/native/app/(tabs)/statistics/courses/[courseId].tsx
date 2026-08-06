/**
 * Course detail — native twin of apps/web/app/statistics/courses/[courseId]/
 * page.tsx (back link, course header, summary cards, hole-by-hole averages
 * with a front/back selector, rounds list linking to calculations).
 */
import { queryOptions, useQuery } from "@tanstack/react-query";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import type { Href } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { tokens } from "@handicappin/tokens/tokens";

import { QuarantineBadge } from "@/components/billing/quarantine-badge";
import { DataSettledMarker } from "@/components/data-settled";
import { SegmentedTabs, StatCard } from "@/components/statistics/shared";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { H1, H2 } from "@/components/ui/typography";
import { trpcQuery } from "@/lib/api/client";
import {
  courseDetailSchema,
  type CourseDetailRound,
} from "@/lib/api/schemas/stats";
import { useSession } from "@/lib/auth/session-provider";
import { useColorMode } from "@/lib/color-mode";
import { getFlagEmoji } from "@/lib/frivolities";
import { useDataSettled } from "@/lib/query/settle";
import { getCourseDetailDisplay } from "@/lib/statistics/course-detail-display";
import {
  formatDifferential,
  formatScore,
  formatWithSign,
} from "@/lib/statistics/format-utils";

const ICON_SIZE = 16; // allow-hardcoded lucide icon prop mirrors web's fixed h-4 w-4 icon box

const courseDetailQueryOptions = (courseId: number) =>
  queryOptions({
    queryKey: ["stats.getCourseDetail", courseId] as const,
    queryFn: () =>
      trpcQuery("stats.getCourseDetail", { courseId }, courseDetailSchema),
  });

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

const holesPlayedLabel = (
  holesPlayed: number,
  section: "front" | "back" | null,
) => {
  if (holesPlayed === 18) return "18";
  return section === "back" ? "9 (back)" : "9 (front)";
};

export default function CourseDetailScreen() {
  const { session, initializing } = useSession();
  const params = useLocalSearchParams<{ courseId?: string }>();
  const insets = useSafeAreaInsets();
  const mode = useColorMode();
  const [holeHalf, setHoleHalf] = useState<"front" | "back">("front");

  const courseId = Number(
    typeof params.courseId === "string" ? params.courseId : NaN,
  );
  const detailQuery = useQuery({
    ...courseDetailQueryOptions(courseId),
    enabled: session != null && Number.isInteger(courseId) && courseId > 0,
  });
  const settled = useDataSettled([detailQuery]);

  if (initializing) return null;
  if (!session) return <Redirect href="/login" />;

  const detail = detailQuery.data;

  if (!detail) {
    return (
      <View
        testID="course-detail-screen"
        className="flex-1 bg-background items-center justify-center p-lg"
      >
        <DataSettledMarker settled={settled} />
        <Text className="text-body text-muted-foreground">
          {detailQuery.isPending ? "Loading course…" : "Course not found"}
        </Text>
      </View>
    );
  }

  const { course, summary, rounds, holes } = detail;
  // Quarantined rounds are listed but not counted (D4) — the two populations
  // differ, so the empty state keys off the LIST and the statistics key off
  // the counted total.
  const display = getCourseDetailDisplay(rounds.length, summary.roundCount);
  const visibleHoles = holes.filter((hole) =>
    holeHalf === "front" ? hole.holeNumber <= 9 : hole.holeNumber > 9,
  );

  return (
    <ScrollView
      testID="course-detail-screen"
      className="flex-1 bg-background"
      contentContainerStyle={{
        paddingTop: insets.top + tokens.spacing.md,
        paddingHorizontal: tokens.spacing.md,
        paddingBottom: tokens.spacing["3xl"],
        gap: tokens.spacing.xl,
      }}
    >
      <DataSettledMarker settled={settled} />

      <Pressable
        accessibilityRole="link"
        onPress={() => router.back()}
        className="flex-row items-center gap-xs"
      >
        <ChevronLeft
          size={ICON_SIZE}
          color={tokens.colors[mode]["muted-foreground"]}
        />
        <Text className="text-body-sm text-muted-foreground">
          Back to statistics
        </Text>
      </Pressable>

      <View className="gap-xs">
        <Text className="text-eyebrow text-muted-foreground">Course</Text>
        <H1>
          {getFlagEmoji(course.country)} {course.name}
        </H1>
        <Text className="text-body text-muted-foreground">
          {course.city}, {course.country}
        </Text>
      </View>

      {display.state === "empty" ? (
        <Card>
          <CardContent>
            <EmptyState
              title="No rounds at this course yet"
              description="Log a round here to start building stats."
            />
          </CardContent>
        </Card>
      ) : display.state === "all-quarantined" ? (
        <>
          {/* Every round here is quarantined: there is nothing to aggregate,
              but the rounds themselves must stay visible (D4). */}
          <Alert>
            <AlertTitle>No stats for this course yet</AlertTitle>
            <AlertDescription>
              {display.listedRounds === 1
                ? "Your round here was saved past the free-tier limit, so it doesn't count toward your handicap or these statistics. Upgrade to unlock it."
                : `All ${display.listedRounds} of your rounds here were saved past the free-tier limit, so they don't count toward your handicap or these statistics. Upgrade to unlock them.`}
            </AlertDescription>
          </Alert>
          <RoundsSection
            rounds={rounds}
            quarantinedRounds={display.quarantinedRounds}
            listedRounds={display.listedRounds}
          />
        </>
      ) : (
        <>
          <View className="flex-row flex-wrap gap-md">
            <View style={{ flexBasis: "45%", flexGrow: 1 }}>
              <StatCard
                centered
                title="Rounds"
                value={summary.roundCount}
                subtitle="played here"
                valueClassName="text-figure-lg"
              />
            </View>
            <View style={{ flexBasis: "45%", flexGrow: 1 }}>
              <StatCard
                centered
                title="Avg Score"
                value={formatScore(summary.avgScore ?? Number.NaN)}
                subtitle={`across ${summary.roundCount} round${summary.roundCount !== 1 ? "s" : ""}`}
                valueClassName="text-figure-lg"
              />
            </View>
            <View style={{ flexBasis: "45%", flexGrow: 1 }}>
              <StatCard
                centered
                title="Avg Differential"
                value={formatDifferential(summary.avgDifferential ?? Number.NaN)}
                subtitle="lower is better"
                valueClassName="text-figure-lg"
              />
            </View>
            <View style={{ flexBasis: "45%", flexGrow: 1 }}>
              <StatCard
                centered
                title="Best / Worst Diff"
                value={`${formatDifferential(summary.bestDifferential ?? Number.NaN)} / ${formatDifferential(summary.worstDifferential ?? Number.NaN)}`}
                subtitle="spread"
                valueClassName="text-figure-sm"
              />
            </View>
          </View>

          <View className="h-px bg-border" />

          <View className="gap-md">
            <View>
              <H2 className="text-heading-3 pb-0">Hole-by-hole averages</H2>
              <Text className="text-body-sm text-muted-foreground mt-xs">
                Aggregated across your {summary.roundCount} round
                {summary.roundCount !== 1 ? "s" : ""} here.
              </Text>
            </View>
            <SegmentedTabs
              tabs={[
                { value: "front", label: "Front 9" },
                { value: "back", label: "Back 9" },
              ]}
              value={holeHalf}
              onChange={setHoleHalf}
            />
            <Card>
              <CardContent className="p-0 pt-0">
                <View className="flex-row border-b border-border">
                  {["Hole", "Par", "Avg", "vs Par", "Best"].map((label) => (
                    <Text
                      key={label}
                      className="flex-1 text-label-sm text-foreground px-sm py-sm text-center"
                    >
                      {label}
                    </Text>
                  ))}
                </View>
                {visibleHoles.map((hole) => (
                  <View
                    key={hole.holeNumber}
                    className="flex-row border-b border-border"
                  >
                    <Text className="flex-1 text-body-sm text-foreground px-sm py-sm text-center">
                      {hole.holeNumber}
                    </Text>
                    <Text className="flex-1 text-body-sm text-foreground px-sm py-sm text-center">
                      {hole.par}
                    </Text>
                    <Text className="flex-1 text-body-sm text-foreground px-sm py-sm text-center">
                      {hole.playCount > 0 ? hole.avgStrokes.toFixed(1) : "—"}
                    </Text>
                    <Text className="flex-1 text-body-sm text-muted-foreground px-sm py-sm text-center">
                      {hole.playCount > 0
                        ? formatWithSign(hole.avgVsPar)
                        : "—"}
                    </Text>
                    <Text className="flex-1 text-body-sm text-foreground px-sm py-sm text-center">
                      {hole.playCount > 0 ? hole.best : "—"}
                    </Text>
                  </View>
                ))}
              </CardContent>
            </Card>
          </View>

          <View className="h-px bg-border" />

          <RoundsSection
            rounds={rounds}
            quarantinedRounds={display.quarantinedRounds}
            listedRounds={display.listedRounds}
          />
        </>
      )}
    </ScrollView>
  );
}

/**
 * Per-course rounds list — native twin of RoundsSection in
 * apps/web/app/statistics/courses/[courseId]/page.tsx. Shows EVERY round at
 * the course, quarantined ones included (D4), each badged the same way the
 * activity feed badges them so a non-counting round is never displayed as if
 * it counts.
 */
function RoundsSection({
  rounds,
  quarantinedRounds,
  listedRounds,
}: {
  rounds: CourseDetailRound[];
  quarantinedRounds: number;
  listedRounds: number;
}) {
  return (
    <View className="gap-md">
      <View>
        <H2 className="text-heading-3 pb-0">Rounds here</H2>
        {quarantinedRounds > 0 ? (
          <Text className="text-body-sm text-muted-foreground mt-xs">
            {quarantinedRounds} of {listedRounds} don&apos;t count toward the
            stats above.
          </Text>
        ) : null}
      </View>
      <View className="gap-sm">
        {rounds.map((round) => (
          <Pressable
            key={round.id}
            accessibilityRole="link"
            onPress={() =>
              router.push(`/rounds/${round.id}/calculation` as Href)
            }
          >
            <Card>
              <CardContent className="p-md pt-md">
                <View className="flex-row items-center justify-between">
                  <View>
                    <Text className="text-body font-medium text-foreground">
                      {formatDate(round.teeTime)}
                    </Text>
                    <Text className="text-meta text-muted-foreground">
                      {round.teeName} ·{" "}
                      {holesPlayedLabel(
                        round.holesPlayed,
                        round.nineHoleSection,
                      )}{" "}
                      holes
                    </Text>
                  </View>
                  <View className="items-end">
                    <Text className="text-figure-sm text-foreground">
                      {round.totalStrokes}
                    </Text>
                    <Text className="text-meta text-muted-foreground">
                      {formatDifferential(round.scoreDifferential)} diff
                    </Text>
                  </View>
                </View>
                {round.quarantined ? (
                  <QuarantineBadge className="mt-sm" />
                ) : null}
              </CardContent>
            </Card>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
