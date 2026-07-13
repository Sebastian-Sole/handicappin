/**
 * Add round — native twin of apps/web/app/rounds/add/page.tsx +
 * components/scorecard/golf-scorecard.tsx (the core flow: course search,
 * tee selection, 18/9 hole count with section, score entry, notes, submit
 * through round.submitScorecard — the same real write path web uses).
 *
 * Deferred to web with logged rationale (implementation log): add-course /
 * add-tee dialogs and the AI scorecard upload (each is a substantial
 * sub-flow; the pickers point users at handicappin.com meanwhile). Tee time
 * defaults to "now" — a native date picker needs a new native module
 * (deferred; logged).
 */
import DateTimePicker from "@react-native-community/datetimepicker";
import { useQuery } from "@tanstack/react-query";
import { Redirect, router } from "expo-router";
import { Plus, X } from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { tokens } from "@handicappin/tokens/tokens";

import { AddCourseModal } from "@/components/scorecard/add-course-modal";
import { AddTeeModal } from "@/components/scorecard/add-tee-modal";
import { CoursePicker } from "@/components/scorecard/course-picker";
import {
  ScorecardTable,
  type ScoreDetail,
} from "@/components/scorecard/scorecard-table";
import { UsageLimitAlert } from "@/components/scorecard/usage-limit-alert";
import { TeePicker } from "@/components/scorecard/tee-picker";
import { DataSettledMarker } from "@/components/data-settled";
import { Button } from "@/components/ui/button";
import { FormFeedback } from "@/components/ui/form-feedback";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { H1 } from "@/components/ui/typography";
import { analytics } from "@/lib/analytics";
import { profileQueryOptions } from "@/lib/api/procedures/auth";
import { roundCountQueryOptions } from "@/lib/api/procedures/round";
import {
  courseTeesQueryOptions,
  submitScorecard,
  type FetchedTee,
  type SearchedCourse,
} from "@/lib/api/procedures/scorecard";
import { useSession } from "@/lib/auth/session-provider";
import { useColorMode } from "@/lib/color-mode";
import { useDataSettled } from "@/lib/query/settle";
import {
  FREE_TIER_ROUND_LIMIT,
  getDisplayedHoles,
  roundToNearestMinute,
  type ScoreInput,
  type Tee,
} from "@/lib/scorecard";
import type { CourseForm } from "@/lib/scorecard-form";
import { cn } from "@/lib/utils";

/** Search returns approved courses only; a just-added course is pending. */
type SelectedCourse = Omit<SearchedCourse, "approvalStatus"> & {
  approvalStatus: "approved" | "pending";
};

type SubmitState = "idle" | "loading" | "success" | "error";

// Cold deep links open the modal with no history — fall back to Home.
const closeModal = () => {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace("/");
  }
};

interface FeedbackState {
  type: "success" | "error" | "info";
  message: string;
}

const emptyScores = (): ScoreInput[] =>
  Array.from({ length: 18 }, () => ({ strokes: 0, hcpStrokes: 0 }));

const CLOSE_ICON_SIZE = 20; // allow-hardcoded lucide icon prop inside the 40px close button

export default function AddRoundScreen() {
  const { session, initializing } = useSession();
  const userId = session?.user.id ?? null;
  const insets = useSafeAreaInsets();
  const mode = useColorMode();
  const mutedForeground = tokens.colors[mode]["muted-foreground"];

  const [selectedCourse, setSelectedCourse] = useState<SelectedCourse | null>(
    null,
  );
  const [selectedTee, setSelectedTee] = useState<FetchedTee | null>(null);
  // Add-course/add-tee dialogs (D21): new entities live in client state
  // until submit creates them server-side as "pending" — mirroring web's
  // modifications pattern.
  const [addCourseOpen, setAddCourseOpen] = useState(false);
  const [addTeeOpen, setAddTeeOpen] = useState(false);
  const [addCoursePrefill, setAddCoursePrefill] = useState("");
  const [addedCourse, setAddedCourse] = useState<CourseForm | null>(null);
  const [addedTees, setAddedTees] = useState<Record<number, FetchedTee[]>>(
    {},
  );
  const [holeCount, setHoleCount] = useState<18 | 9>(18);
  const [nineHoleSection, setNineHoleSection] = useState<"front" | "back">(
    "front",
  );
  const [scores, setScores] = useState<ScoreInput[]>(emptyScores());
  // "Detailed scoring" (plans/010): opt-in putts/fairway/penalty entry.
  // Off by default every visit (mirrors web: no persisted preference).
  const [detailedScoring, setDetailedScoring] = useState(false);
  const [notes, setNotes] = useState("");
  const [teeTime, setTeeTime] = useState(() =>
    roundToNearestMinute(new Date()).toISOString(),
  );
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [submitState, setSubmitState] = useState<SubmitState>("idle");

  // Post-submit "heading home" timer — cleared on unmount so a user who
  // navigates away inside the grace window isn't yanked back to Home.
  const navTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (navTimer.current) clearTimeout(navTimer.current);
    };
  }, []);

  // Manual add-round form opened (plan 009 funnel entry; submission success
  // is captured SERVER-side in round.submitScorecard as round_submitted).
  useEffect(() => {
    analytics.capture("round_add_started", { method: "manual" });
  }, []);

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
    // A just-added course (id -1) exists only client-side — nothing to fetch.
    enabled: selectedCourse != null && selectedCourse.id > 0,
  });

  const settled = useDataSettled([profileQuery, roundCountQuery]);

  const tees = useMemo<FetchedTee[]>(() => {
    if (selectedCourse?.id === -1) {
      return (addedCourse?.tees ?? []) as FetchedTee[];
    }
    const fetched = teesQuery.data ?? [];
    const extras = selectedCourse ? (addedTees[selectedCourse.id] ?? []) : [];
    return [...fetched, ...extras];
  }, [teesQuery.data, selectedCourse, addedCourse, addedTees]);
  // Auto-select the first tee when the list arrives (web behavior).
  if (tees.length > 0 && selectedTee === null) {
    setSelectedTee(tees[0] ?? null);
  }

  const handleCourseAdded = (course: CourseForm) => {
    setAddedCourse(course);
    setSelectedCourse({
      id: -1,
      name: course.name,
      city: course.city,
      country: course.country,
      website: course.website ?? "",
      approvalStatus: "pending",
    });
    setSelectedTee((course.tees?.[0] as FetchedTee | undefined) ?? null);
  };

  const handleTeeAdded = (tee: Tee) => {
    if (!selectedCourse) return;
    const fetchedShaped = tee as FetchedTee;
    if (selectedCourse.id === -1) {
      setAddedCourse((prev) =>
        prev ? { ...prev, tees: [...(prev.tees ?? []), tee] } : prev,
      );
    } else {
      setAddedTees((prev) => ({
        ...prev,
        [selectedCourse.id]: [
          ...(prev[selectedCourse.id] ?? []),
          fetchedShaped,
        ],
      }));
    }
    setSelectedTee(fetchedShaped);
  };

  const displayedHoles = useMemo(
    () =>
      getDisplayedHoles(
        selectedTee ? { holes: selectedTee.holes as Tee["holes"] } : undefined,
        holeCount,
        nineHoleSection,
      ),
    [selectedTee, holeCount, nineHoleSection],
  );

  // Wait out session restore before deciding auth — a cold-start deep link
  // would otherwise bounce login → home and lose the destination.
  if (initializing) return null;
  if (userId == null) return <Redirect href="/login" />;

  const profile = profileQuery.data;
  const remainingRounds =
    profile?.plan_selected === "free"
      ? Math.max(0, FREE_TIER_ROUND_LIMIT - (roundCountQuery.data ?? 0))
      : Infinity;

  const handleScoreChange = (holeIndex: number, strokes: number) => {
    setScores((prev) => {
      const next = [...prev];
      // Preserve any shot-level detail already entered for this hole.
      next[holeIndex] = { ...next[holeIndex], strokes, hcpStrokes: 0 };
      return next;
    });
  };

  const handleScoreDetailChange = (holeIndex: number, detail: ScoreDetail) => {
    setScores((prev) => {
      const next = [...prev];
      next[holeIndex] = { ...next[holeIndex], ...detail };
      return next;
    });
  };

  const handleDetailedScoringToggle = (enabled: boolean) => {
    setDetailedScoring(enabled);
    analytics.capture("detailed_scoring_toggled", { enabled });
  };

  const busy = submitState === "loading" || submitState === "success";

  const onSubmit = async () => {
    if (!selectedCourse || !selectedTee || !userId) {
      setFeedback({
        type: "error",
        message: "Please select a course and tee first",
      });
      return;
    }
    const playedScores = scores.slice(0, holeCount);
    if (playedScores.some((score) => score.strokes === 0)) {
      setFeedback({
        type: "error",
        message:
          holeCount === 9
            ? "Please enter scores for all 9 holes"
            : "Please enter scores for all 18 holes",
      });
      return;
    }

    setSubmitState("loading");
    setFeedback(null);
    try {
      const isAutoApproved =
        selectedCourse.approvalStatus === "approved" &&
        selectedTee.approvalStatus === "approved";

      await submitScorecard({
        userId,
        course: {
          id: selectedCourse.id,
          name: selectedCourse.name,
          // Pass the REAL status: "pending" tells the server to create a
          // just-added course (it was hardcoded "approved" before D21).
          approvalStatus: selectedCourse.approvalStatus,
          country: selectedCourse.country,
          city: selectedCourse.city,
          website: selectedCourse.website ?? "",
        },
        teePlayed: selectedTee as Tee,
        // Detailed scoring on: penalties default to 0 for entered holes
        // (the "+" control means "0 unless stated"). Off: strip any detail
        // so a toggled-off submission is byte-identical to the old payload.
        scores: playedScores.map((score) =>
          detailedScoring
            ? { ...score, penaltyStrokes: score.penaltyStrokes ?? 0 }
            : {
                ...score,
                putts: undefined,
                fairwayHit: undefined,
                penaltyStrokes: undefined,
              },
        ),
        teeTime,
        approvalStatus: isAutoApproved ? "approved" : "pending",
        notes,
        nineHoleSection: holeCount === 9 ? nineHoleSection : undefined,
      });

      setSubmitState("success");
      setFeedback({
        type: "success",
        message: "Round submitted! Heading home...",
      });
      navTimer.current = setTimeout(() => router.replace("/"), 1500);
    } catch (error) {
      setSubmitState("error");
      setFeedback({
        type: "error",
        message:
          error instanceof Error ? error.message : "Failed to submit scorecard",
      });
      setTimeout(() => setSubmitState("idle"), 2000);
    }
  };

  // Free tier exhausted: mirror web's UsageLimitReachedView.
  if (profile?.plan_selected === "free" && remainingRounds <= 0) {
    return (
      <View
        testID="add-round-screen"
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
      testID="add-round-screen"
      className="flex-1 bg-background"
      contentContainerStyle={{
        paddingTop: insets.top + tokens.spacing.md,
        paddingHorizontal: tokens.spacing.md,
        paddingBottom: tokens.spacing["3xl"],
        gap: tokens.spacing.md,
      }}
      keyboardShouldPersistTaps="handled"
    >
      <DataSettledMarker settled={settled} />
      <View className="flex-row items-start justify-between gap-md">
        <H1 className="flex-1">Add Round</H1>
        <Pressable
          testID="close-add-round"
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={closeModal}
          className="h-10 w-10 items-center justify-center rounded-full bg-muted active:opacity-80"
        >
          <X size={CLOSE_ICON_SIZE} color={mutedForeground} />
        </Pressable>
      </View>
      <Text className="text-body-sm text-muted-foreground">
        Fill out the scorecard to register your round.
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

      {feedback ? (
        <FormFeedback
          type={feedback.type}
          message={feedback.message}
          onClose={() => setFeedback(null)}
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
            disabled={busy}
            onSelect={(course) => {
              setSelectedCourse(course);
              setSelectedTee(null);
            }}
            onRequestAddCourse={(initialName) => {
              setAddCoursePrefill(initialName);
              setAddCourseOpen(true);
            }}
          />
          <Button
            testID="add-course-trigger"
            variant="outline"
            disabled={busy}
            onPress={() => {
              setAddCoursePrefill("");
              setAddCourseOpen(true);
            }}
          >
            <View className="flex-row items-center gap-sm">
              <Plus size={CLOSE_ICON_SIZE} color={mutedForeground} />
              <Text className="text-label-sm text-foreground">
                Add New Course
              </Text>
            </View>
          </Button>
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
            disabled={busy || !selectedCourse}
            onSelect={setSelectedTee}
          />
          <Button
            testID="add-tee-trigger"
            variant="outline"
            disabled={busy || !selectedCourse}
            onPress={() => setAddTeeOpen(true)}
          >
            <View className="flex-row items-center gap-sm">
              <Plus size={CLOSE_ICON_SIZE} color={mutedForeground} />
              <Text className="text-label-sm text-foreground">
                Add New Tee
              </Text>
            </View>
          </Button>
        </View>

        <View className="gap-sm">
          <Label>Holes</Label>
          <View className="flex-row gap-sm">
            {[18, 9].map((count) => (
              <Button
                key={count}
                testID={`hole-count-${count}`}
                variant={holeCount === count ? "default" : "outline"}
                className="flex-1"
                disabled={busy}
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
                  disabled={busy}
                  onPress={() => setNineHoleSection(section)}
                >
                  {section === "front" ? "Front 9" : "Back 9"}
                </Button>
              ))}
            </View>
          </View>
        ) : null}

        <View className="gap-sm">
          <Label>Tee time</Label>
          {/* Same semantics as web's DatePicker: free date+time choice,
              rounded to the nearest minute (no min/max — web has none). */}
          <View className="flex-row">
            <DateTimePicker
              testID="tee-time-picker"
              value={new Date(teeTime)}
              mode="datetime"
              display="compact"
              themeVariant={mode}
              accentColor={tokens.colors[mode].primary}
              disabled={busy}
              onValueChange={(_event, date) => {
                // Android delivers undefined on dismiss; iOS never does, but
                // the Android pass is deferred work — don't leave it a crash.
                if (!date) return;
                setTeeTime(roundToNearestMinute(date).toISOString());
              }}
            />
          </View>
        </View>

        <View className="flex-row items-center justify-between gap-sm">
          <View className="flex-1 gap-xs">
            <Label>Detailed scoring</Label>
            <Text className="text-body-sm text-muted-foreground">
              Track putts, fairways, and penalties per hole
            </Text>
          </View>
          <Switch
            testID="detailed-scoring-toggle"
            accessibilityLabel="Detailed scoring"
            checked={detailedScoring}
            onCheckedChange={handleDetailedScoringToggle}
            disabled={busy}
          />
        </View>
      </View>

      {selectedTee && displayedHoles.length > 0 ? (
        <ScorecardTable
          selectedTee={selectedTee as Tee}
          displayedHoles={displayedHoles}
          holeCount={holeCount}
          scores={scores}
          onScoreChange={handleScoreChange}
          disabled={busy}
          detailedScoring={detailedScoring}
          onScoreDetailChange={handleScoreDetailChange}
        />
      ) : (
        <View className="rounded-lg border border-border p-lg items-center">
          <Text className="text-body text-muted-foreground text-center">
            Select a course and tee to enter scores
          </Text>
        </View>
      )}

      <View className="gap-sm">
        <Label>Notes</Label>
        <Input
          testID="round-notes"
          placeholder="Optional notes about the round"
          multiline
          numberOfLines={3}
          className={cn("h-auto py-sm", "min-h-20")}
          value={notes}
          onChangeText={setNotes}
          editable={!busy}
        />
      </View>

      <Button
        testID="submit-round"
        className="w-full"
        disabled={busy || !selectedCourse || !selectedTee}
        onPress={() => {
          void onSubmit();
        }}
      >
        {submitState === "loading"
          ? "Submitting..."
          : submitState === "success"
            ? "Submitted!"
            : "Submit Round"}
      </Button>

      <AddCourseModal
        open={addCourseOpen}
        initialCourseName={addCoursePrefill}
        onClose={() => setAddCourseOpen(false)}
        onAdd={handleCourseAdded}
      />
      <AddTeeModal
        open={addTeeOpen}
        onClose={() => setAddTeeOpen(false)}
        onSave={handleTeeAdded}
      />
    </ScrollView>
  );
}
