/**
 * Finish flow: review the scorecard, pick tee time/notes, submit through
 * the existing round.submitScorecard write path.
 *
 * USGA 9-or-18 rule drives what's offered: all 18 → submit 18; exactly one
 * complete nine of an 18-hole session → submit as that 9-hole round
 * (USGA 5.1b); complete 9-hole session → submit 9; anything ragged → jump
 * chips back to the unscored holes (or discard).
 *
 * Failure triage: transport errors park the payload in the pendingSubmit
 * slot (the session stays on-device) for opportunistic retry; server
 * rejections surface the message and keep the session for the user to
 * resolve — never auto-retried.
 */
import DateTimePicker from "@react-native-community/datetimepicker";
import { useQueryClient } from "@tanstack/react-query";
import { Redirect, router } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { Alert, AppState, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { tokens } from "@handicappin/tokens/tokens";

import { DataSettledMarker } from "@/components/data-settled";
import { ScorecardTable } from "@/components/scorecard/scorecard-table";
import { Button } from "@/components/ui/button";
import { FormFeedback } from "@/components/ui/form-feedback";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { H1 } from "@/components/ui/typography";
import { submitScorecard } from "@/lib/api/procedures/scorecard";
import { useColorMode } from "@/lib/color-mode";
import {
  invalidateRoundQueries,
  isTransportError,
  retryPendingSubmit,
} from "@/lib/round-session/pending-submit";
import { finishEligibility } from "@/lib/round-session/selectors";
import {
  clearRoundSession,
  dispatch,
  getSession,
  sessionPersistence,
  useRoundSession,
} from "@/lib/round-session/store";
import {
  toScorecardInput,
  type SubmitAs,
} from "@/lib/round-session/to-scorecard";
import { roundToNearestMinute, type Score, type Tee } from "@/lib/scorecard";
import { cn } from "@/lib/utils";

type SubmitState = "idle" | "loading" | "success" | "offline" | "error";

interface FeedbackState {
  type: "success" | "error" | "info";
  message: string;
}

const BACK_ICON_SIZE = 20; // allow-hardcoded lucide icon prop inside the 40px back button

export default function LiveRoundReviewScreen() {
  const session = useRoundSession();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const mode = useColorMode();
  const mutedForeground = tokens.colors[mode]["muted-foreground"];

  const [teeTime, setTeeTime] = useState(
    () => getSession()?.startedAt ?? new Date().toISOString(),
  );
  const [notes, setNotes] = useState(() => getSession()?.notes ?? "");
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);

  const navTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (navTimer.current) clearTimeout(navTimer.current);
    };
  }, []);

  // While parked offline, retry automatically right here — the Home-mount /
  // foreground hook never fires for a user who stays on this screen after
  // connectivity returns. retryPendingSubmit() coalesces concurrent callers.
  useEffect(() => {
    if (submitState !== "offline") return;
    let cancelled = false;
    const attempt = async () => {
      const outcome = await retryPendingSubmit();
      if (cancelled) return;
      if (outcome !== "failed") {
        // submitted/deduped — or "none": the slot was already flushed by
        // another surface. Either way the round is on the server.
        invalidateRoundQueries(queryClient);
        router.replace("/");
      }
    };
    const interval = setInterval(() => {
      void attempt();
    }, 6000);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void attempt();
    });
    return () => {
      cancelled = true;
      clearInterval(interval);
      subscription.remove();
    };
  }, [submitState, queryClient]);

  if (!session) {
    // Post-success the session is cleared in the same tick as the redirect
    // home; render nothing rather than bouncing through setup.
    return submitState === "success" ? null : (
      <Redirect href="/rounds/live/setup" />
    );
  }

  const busy = submitState === "loading" || submitState === "success";
  const eligibility = finishEligibility(session);
  const nowIso = () => new Date().toISOString();

  const goHome = () => {
    clearRoundSession();
    router.replace("/");
  };

  const succeed = (message: string) => {
    invalidateRoundQueries(queryClient);
    setSubmitState("success");
    setFeedback({ type: "success", message });
    navTimer.current = setTimeout(goHome, 1500);
  };

  const onSubmit = async (submitAs: SubmitAs) => {
    const current = getSession();
    if (busy || !current || current.status !== "active") return;
    if (notes !== current.notes) {
      dispatch({ type: "NOTES_SET", notes, at: nowIso() });
    }
    // Status gate: everything below runs against the "finishing" session;
    // a second tap bails on `busy`/status before getting here.
    const finishing = dispatch({ type: "FINISH_STARTED", at: nowIso() });
    if (!finishing) return;

    setSubmitState("loading");
    setFeedback(null);

    let payload;
    try {
      payload = toScorecardInput(finishing, { teeTime, submitAs });
    } catch (error) {
      dispatch({ type: "FINISH_CANCELLED", at: nowIso() });
      setSubmitState("error");
      setFeedback({
        type: "error",
        message:
          error instanceof Error ? error.message : "Round can't be submitted",
      });
      return;
    }

    try {
      await submitScorecard(payload);
      dispatch({ type: "SUBMITTED", at: nowIso() });
      sessionPersistence.clearPendingSubmit();
      succeed("Round submitted! Heading home...");
    } catch (error) {
      dispatch({ type: "FINISH_CANCELLED", at: nowIso() });
      if (isTransportError(error)) {
        sessionPersistence.savePendingSubmit({
          v: 1,
          sessionId: finishing.id,
          payload,
          attempts: 1,
          lastAttemptAt: nowIso(),
        });
        setSubmitState("offline");
        setFeedback({
          type: "info",
          message:
            "You're offline — your round is safe on this phone. We'll submit it automatically when you're back online.",
        });
      } else {
        setSubmitState("error");
        setFeedback({
          type: "error",
          message:
            error instanceof Error
              ? error.message
              : "Failed to submit the round",
        });
      }
    }
  };

  const onRetry = async () => {
    if (busy) return;
    setSubmitState("loading");
    const outcome = await retryPendingSubmit();
    if (outcome !== "failed") {
      // Round is on the server (retryPendingSubmit already cleared the
      // session + slot) — go home directly; lingering here would render
      // against a null session.
      invalidateRoundQueries(queryClient);
      router.replace("/");
    } else {
      setSubmitState("offline");
      setFeedback({
        type: "info",
        message:
          "Still offline — we'll retry automatically as soon as you have a connection.",
      });
    }
  };

  const confirmDiscard = () => {
    Alert.alert(
      "Discard this round?",
      "All scores from this round will be lost.",
      [
        { text: "Keep round", style: "cancel" },
        { text: "Discard", style: "destructive", onPress: goHome },
      ],
    );
  };

  const scores: Score[] = session.entries.map((entry) => ({
    strokes: entry.strokes ?? 0,
    hcpStrokes: 0,
  }));

  const hasPendingSubmit =
    submitState === "offline" &&
    sessionPersistence.loadPendingSubmit() !== null;

  return (
    <ScrollView
      testID="live-review-screen"
      className="flex-1 bg-background"
      contentContainerStyle={{
        paddingTop: insets.top + tokens.spacing.md,
        paddingHorizontal: tokens.spacing.md,
        paddingBottom: insets.bottom + tokens.spacing["3xl"],
        gap: tokens.spacing.md,
      }}
      keyboardShouldPersistTaps="handled"
    >
      <DataSettledMarker settled />
      <View className="flex-row items-center gap-md">
        <Pressable
          testID="live-review-back"
          accessibilityRole="button"
          accessibilityLabel="Back to holes"
          disabled={busy}
          onPress={() => router.back()}
          className="h-10 w-10 items-center justify-center rounded-full bg-muted active:opacity-80"
        >
          <ArrowLeft size={BACK_ICON_SIZE} color={mutedForeground} />
        </Pressable>
        <H1 className="flex-1">Finish Round</H1>
      </View>

      <ScorecardTable
        selectedTee={session.tee as Tee}
        displayedHoles={session.displayedHoles}
        holeCount={session.holeCount}
        scores={scores}
        onScoreChange={() => {}}
        disabled
      />

      <View className="rounded-lg border border-border bg-card p-md gap-md">
        <View className="gap-sm">
          <Label>Tee time</Label>
          <View className="flex-row">
            <DateTimePicker
              testID="live-tee-time-picker"
              value={new Date(teeTime)}
              mode="datetime"
              display="compact"
              themeVariant={mode}
              accentColor={tokens.colors[mode].primary}
              disabled={busy}
              onValueChange={(_event, date) => {
                if (!date) return;
                setTeeTime(roundToNearestMinute(date).toISOString());
              }}
            />
          </View>
        </View>

        <View className="gap-sm">
          <Label>Notes</Label>
          <Input
            testID="live-review-notes"
            placeholder="Optional notes about the round"
            multiline
            numberOfLines={3}
            className={cn("h-auto py-sm", "min-h-20")}
            value={notes}
            onChangeText={setNotes}
            editable={!busy}
          />
        </View>
      </View>

      {hasPendingSubmit ? (
        <Button
          testID="live-retry-submit"
          className="w-full"
          onPress={() => {
            void onRetry();
          }}
        >
          Retry now
        </Button>
      ) : eligibility.as18 ? (
        <Button
          testID="live-submit-18"
          className="w-full"
          disabled={busy}
          onPress={() => {
            void onSubmit("18");
          }}
        >
          {submitState === "loading"
            ? "Submitting..."
            : submitState === "success"
              ? "Submitted!"
              : "Submit 18 holes"}
        </Button>
      ) : eligibility.asNine !== null ? (
        <View className="gap-sm">
          {session.holeCount === 18 ? (
            <Text className="text-body-sm text-muted-foreground">
              Only the {eligibility.asNine} nine is complete — it can be
              posted as a 9-hole round (USGA rules allow 9 or 18 holes).
            </Text>
          ) : null}
          <Button
            testID="live-submit-9"
            className="w-full"
            disabled={busy}
            onPress={() => {
              void onSubmit(
                session.holeCount === 9
                  ? "nine"
                  : eligibility.asNine === "front"
                    ? "front9"
                    : "back9",
              );
            }}
          >
            {submitState === "loading"
              ? "Submitting..."
              : submitState === "success"
                ? "Submitted!"
                : session.holeCount === 9
                  ? "Submit round"
                  : `Submit as 9-hole (${eligibility.asNine} 9)`}
          </Button>
        </View>
      ) : (
        <View className="gap-md">
          <Text className="text-body text-foreground">
            A round must be a full 18 or a complete nine to count for your
            handicap. Still missing:
          </Text>
          <View className="flex-row flex-wrap gap-sm">
            {eligibility.missing.map((index) => (
              <Pressable
                key={index}
                testID={`live-missing-hole-${
                  session.displayedHoles[index]?.holeNumber ?? index + 1
                }`}
                accessibilityRole="button"
                accessibilityLabel={`Go to hole ${
                  session.displayedHoles[index]?.holeNumber ?? index + 1
                }`}
                onPress={() => {
                  dispatch({
                    type: "HOLE_SELECTED",
                    holeIndex: index,
                    at: nowIso(),
                  });
                  router.back();
                }}
                className="rounded-full border border-border bg-card px-md py-sm active:opacity-80"
              >
                <Text className="text-label-sm text-foreground">
                  Hole {session.displayedHoles[index]?.holeNumber ?? index + 1}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      <Button
        testID="live-review-discard"
        variant="outline"
        className="w-full"
        disabled={busy}
        onPress={confirmDiscard}
      >
        <Text className="text-label-sm text-destructive">Discard round</Text>
      </Button>

      {/* Feedback sits with the actions it talks about (user-directed),
          not at the top of a scrolling screen. */}
      {feedback ? (
        <FormFeedback
          type={feedback.type}
          message={feedback.message}
          onClose={() => setFeedback(null)}
        />
      ) : null}
    </ScrollView>
  );
}
