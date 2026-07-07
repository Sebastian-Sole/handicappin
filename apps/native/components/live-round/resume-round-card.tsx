/**
 * Home banner for an in-progress live round: resume in one tap or discard.
 * Sessions older than 24h get "unfinished" copy instead (and Home never
 * auto-prompts for them — see the auto-resume effect in (tabs)/index.tsx).
 */
import { router } from "expo-router";
import { Alert, Text, View } from "react-native";

import { formatVsPar } from "@/components/live-round/score-colors";
import { Button } from "@/components/ui/button";
import { isStale, scoredCount, vsPar } from "@/lib/round-session/selectors";
import {
  clearRoundSession,
  useRoundSession,
} from "@/lib/round-session/store";

export function ResumeRoundCard() {
  const session = useRoundSession();
  if (!session) return null;

  const stale = isStale(session, new Date().toISOString());
  const holeNumber =
    session.displayedHoles[session.currentHoleIndex]?.holeNumber ?? 1;

  const confirmDiscard = () => {
    Alert.alert(
      "Discard this round?",
      "All scores from this round will be lost.",
      [
        { text: "Keep round", style: "cancel" },
        {
          text: "Discard",
          style: "destructive",
          onPress: () => clearRoundSession(),
        },
      ],
    );
  };

  return (
    <View
      testID="resume-round-card"
      className="tint-primary rounded-lg p-md gap-sm mx-md mt-sm"
    >
      <Text className="text-label-sm text-foreground">
        {stale ? "Unfinished round" : "Round in progress"}
      </Text>
      <Text className="text-body-sm text-muted-foreground">
        {session.course.name} · hole {holeNumber} · {scoredCount(session)}/
        {session.holeCount} scored · {formatVsPar(vsPar(session))}
      </Text>
      <View className="flex-row gap-sm">
        <Button
          testID="resume-round"
          className="flex-1"
          onPress={() => router.push("/rounds/live")}
        >
          Resume
        </Button>
        <Button
          testID="discard-round"
          variant="outline"
          className="flex-1"
          onPress={confirmDiscard}
        >
          Discard
        </Button>
      </View>
    </View>
  );
}
