/**
 * Live round setup — pick course/tee/holes, then start the on-device
 * session. Mirrors the add-round pickers (no add-course/add-tee here; live
 * play targets existing courses — the scorecard form handles new ones).
 *
 * Prefill comes from the last-setup slot (full tee snapshot), so the
 * repeat-course happy path is a single tap on "Start round" and works
 * fully offline. The free-tier gate only blocks when we KNOW the limit is
 * hit — if the count queries fail (no signal at the course), starting is
 * allowed and the server enforces at submit.
 */
import { useQuery } from "@tanstack/react-query";
import { randomUUID } from "expo-crypto";
import { Redirect, router } from "expo-router";
import { X } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { tokens } from "@handicappin/tokens/tokens";

import { CoursePicker } from "@/components/scorecard/course-picker";
import { TeePicker } from "@/components/scorecard/tee-picker";
import { UsageLimitAlert } from "@/components/scorecard/usage-limit-alert";
import { DataSettledMarker } from "@/components/data-settled";
import { Button } from "@/components/ui/button";
import { FormFeedback } from "@/components/ui/form-feedback";
import { Label } from "@/components/ui/label";
import { H1 } from "@/components/ui/typography";
import { analytics } from "@/lib/analytics";
import { profileQueryOptions } from "@/lib/api/procedures/auth";
import { roundCountQueryOptions } from "@/lib/api/procedures/round";
import {
  courseTeesQueryOptions,
  type FetchedTee,
  type SearchedCourse,
} from "@/lib/api/procedures/scorecard";
import { useSession } from "@/lib/auth/session-provider";
import { useColorMode } from "@/lib/color-mode";
import { useDataSettled } from "@/lib/query/settle";
import type { SessionCourse } from "@/lib/round-session/types";
import {
  sessionPersistence,
  startRoundSession,
} from "@/lib/round-session/store";
import { useOwnedRoundSession } from "@/lib/round-session/use-owned-session";
import {
  FREE_TIER_ROUND_LIMIT,
  roundToNearestMinute,
  type Tee,
} from "@/lib/scorecard";

/** Search returns approved courses only; lastSetup may hold a pending one. */
type SelectedCourse = Omit<SearchedCourse, "approvalStatus"> & {
  approvalStatus: "approved" | "pending";
};

const closeModal = () => {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace("/");
  }
};

const CLOSE_ICON_SIZE = 20; // allow-hardcoded lucide icon prop inside the 40px close button

export default function LiveRoundSetupScreen() {
  const { session, initializing } = useSession();
  const userId = session?.user.id ?? null;
  const insets = useSafeAreaInsets();
  const mode = useColorMode();
  const mutedForeground = tokens.colors[mode]["muted-foreground"];
  // Owned-session check: another account's persisted round must not bounce
  // this user into it. Starting a new round here overwrites that slot
  // (single-slot tradeoff, by design).
  const activeRound = useOwnedRoundSession();

  // Lazy one-time read; full tee snapshot means offline prefill works.
  const [lastSetup] = useState(() => sessionPersistence.loadLastSetup());
  const [selectedCourse, setSelectedCourse] = useState<SelectedCourse | null>(
    lastSetup ? lastSetup.course : null,
  );
  const [selectedTee, setSelectedTee] = useState<FetchedTee | null>(
    lastSetup ? (lastSetup.tee as FetchedTee) : null,
  );
  const [holeCount, setHoleCount] = useState<18 | 9>(
    lastSetup?.holeCount ?? 18,
  );
  const [nineHoleSection, setNineHoleSection] = useState<"front" | "back">(
    lastSetup?.nineHoleSection ?? "front",
  );
  const [error, setError] = useState<string | null>(null);

  const profileQuery = useQuery({
    ...profileQueryOptions(userId ?? ""),
    enabled: userId != null,
  });
  const roundCountQuery = useQuery({
    ...roundCountQueryOptions(userId ?? ""),
    enabled: userId != null,
  });
  const teesQuery = useQuery({
    ...courseTeesQueryOptions(selectedCourse?.id ?? 0),
    enabled: selectedCourse != null && selectedCourse.id > 0,
  });

  const settled = useDataSettled([profileQuery, roundCountQuery]);

  // Live-round setup opened (plan 009 funnel entry).
  useEffect(() => {
    analytics.capture("round_add_started", { method: "live" });
  }, []);

  const tees = useMemo<FetchedTee[]>(() => {
    const fetched = teesQuery.data ?? [];
    // Keep the prefilled tee usable offline (dedupe once the fetch lands).
    if (
      selectedTee &&
      selectedCourse &&
      selectedTee.courseId === selectedCourse.id &&
      !fetched.some((t) => t.id === selectedTee.id)
    ) {
      return [selectedTee, ...fetched];
    }
    return fetched;
  }, [teesQuery.data, selectedTee, selectedCourse]);

  if (initializing) return null;
  if (userId == null) return <Redirect href="/login" />;
  // Single-session invariant: one live round at a time.
  if (activeRound) return <Redirect href="/rounds/live" />;

  const profile = profileQuery.data;
  const remainingRounds =
    profile?.plan_selected === "free"
      ? Math.max(0, FREE_TIER_ROUND_LIMIT - (roundCountQuery.data ?? 0))
      : Infinity;

  const teeHasHoles = (selectedTee?.holes?.length ?? 0) >= 18;
  const canStart = selectedCourse != null && selectedTee != null && teeHasHoles;

  const onStart = () => {
    if (!selectedCourse || !selectedTee || !teeHasHoles) return;
    const now = roundToNearestMinute(new Date()).toISOString();
    const course: SessionCourse = {
      id: selectedCourse.id,
      name: selectedCourse.name,
      city: selectedCourse.city,
      country: selectedCourse.country,
      website: selectedCourse.website ?? "",
      approvalStatus: selectedCourse.approvalStatus,
    };
    try {
      startRoundSession({
        id: randomUUID(),
        userId,
        course,
        tee: selectedTee as Tee,
        holeCount,
        nineHoleSection: holeCount === 9 ? nineHoleSection : undefined,
        now,
      });
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not start the round",
      );
      return;
    }
    sessionPersistence.saveLastSetup({
      v: 1,
      course,
      tee: selectedTee as Tee,
      holeCount,
      ...(holeCount === 9 ? { nineHoleSection } : {}),
      savedAt: now,
    });
    analytics.capture("live_round_started", { holes: holeCount });
    // replace: back from the hole screen must not return to setup.
    router.replace("/rounds/live");
  };

  // Free tier exhausted — only when we positively know (query succeeded).
  if (profile?.plan_selected === "free" && remainingRounds <= 0) {
    return (
      <View
        testID="live-setup-screen"
        className="flex-1 bg-background items-center justify-center p-lg gap-md"
      >
        <DataSettledMarker settled={settled} />
        <H1 className="text-center">Round limit reached</H1>
        <Text className="text-body text-muted-foreground text-center">
          You&apos;ve used all {FREE_TIER_ROUND_LIMIT} free rounds. Upgrade on
          handicappin.com to keep logging.
        </Text>
        <Button variant="outline" onPress={closeModal}>
          Go back
        </Button>
      </View>
    );
  }

  return (
    <ScrollView
      testID="live-setup-screen"
      className="flex-1 bg-background"
      contentContainerStyle={{
        paddingTop: insets.top + tokens.spacing.md,
        paddingHorizontal: tokens.spacing.md,
        paddingBottom: insets.bottom + tokens.spacing["3xl"],
        gap: tokens.spacing.md,
      }}
      keyboardShouldPersistTaps="handled"
    >
      <DataSettledMarker settled={settled} />
      <View className="flex-row items-start justify-between gap-md">
        <H1 className="flex-1">Live Round</H1>
        <Pressable
          testID="close-live-setup"
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={closeModal}
          className="h-10 w-10 items-center justify-center rounded-full bg-muted active:opacity-80"
        >
          <X size={CLOSE_ICON_SIZE} color={mutedForeground} />
        </Pressable>
      </View>
      <Text className="text-body-sm text-muted-foreground">
        Score hole by hole as you play. Your round is saved on this phone
        until you finish — no signal needed on the course.
      </Text>

      {profile?.plan_selected === "free" && remainingRounds > 0 ? (
        <UsageLimitAlert
          current={FREE_TIER_ROUND_LIMIT - remainingRounds}
          total={FREE_TIER_ROUND_LIMIT}
          variant={
            remainingRounds < 5
              ? "critical"
              : remainingRounds < 10
                ? "warning"
                : "default"
          }
        />
      ) : null}

      {error ? (
        <FormFeedback
          type="error"
          message={error}
          onClose={() => setError(null)}
        />
      ) : null}

      <View className="rounded-lg border border-border bg-card p-md gap-md">
        <View className="gap-sm">
          <Label>Course</Label>
          <CoursePicker
            selectedLabel={
              selectedCourse
                ? `${selectedCourse.name} – ${selectedCourse.city}, ${selectedCourse.country}`
                : "Select course..."
            }
            onSelect={(course) => {
              setSelectedCourse(course);
              setSelectedTee(null);
            }}
          />
          <Text className="text-body-sm text-muted-foreground">
            Can&apos;t find your course? Add it via the scorecard form first.
          </Text>
        </View>

        <View className="gap-sm">
          <Label>Tee</Label>
          <TeePicker
            tees={tees}
            selectedLabel={
              selectedTee
                ? `${selectedTee.name} (${selectedTee.gender})`
                : teesQuery.isLoading && selectedCourse
                  ? "Loading tees..."
                  : "Select tee..."
            }
            disabled={!selectedCourse}
            onSelect={setSelectedTee}
          />
        </View>

        <View className="gap-sm">
          <Label>Holes</Label>
          <View className="flex-row gap-sm">
            {[18, 9].map((count) => (
              <Button
                key={count}
                testID={`live-hole-count-${count}`}
                variant={holeCount === count ? "default" : "outline"}
                className="flex-1"
                onPress={() => setHoleCount(count as 18 | 9)}
              >
                {`${count} holes`}
              </Button>
            ))}
          </View>
        </View>

        {holeCount === 9 ? (
          <View className="gap-sm">
            <Label>Section played</Label>
            <View className="flex-row gap-sm">
              {(["front", "back"] as const).map((section) => (
                <Button
                  key={section}
                  variant={nineHoleSection === section ? "default" : "outline"}
                  className="flex-1"
                  onPress={() => setNineHoleSection(section)}
                >
                  {section === "front" ? "Front 9" : "Back 9"}
                </Button>
              ))}
            </View>
          </View>
        ) : null}
      </View>

      <Button
        testID="live-start-round"
        className="w-full"
        disabled={!canStart}
        onPress={onStart}
      >
        Start round
      </Button>
    </ScrollView>
  );
}
