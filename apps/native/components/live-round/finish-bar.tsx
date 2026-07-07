/**
 * Bottom bar: progress toward a submittable round and the Finish action.
 * Turns primary once the round can be submitted (18 full, or a complete
 * nine); before that it shows progress and stays secondary.
 */
import { Text, View } from "react-native";

import { Button } from "@/components/ui/button";
import type { FinishEligibility } from "@/lib/round-session/selectors";

interface FinishBarProps {
  eligibility: FinishEligibility;
  scored: number;
  holeCount: number;
  onFinish: () => void;
}

export function FinishBar({
  eligibility,
  scored,
  holeCount,
  onFinish,
}: FinishBarProps) {
  if (scored === 0) return null;

  const eligible = eligibility.as18 || eligibility.asNine !== null;

  return (
    <View className="flex-row items-center gap-md px-md">
      <Text className="flex-1 text-body-sm text-muted-foreground">
        {eligibility.as18
          ? "All 18 holes scored"
          : eligibility.asNine
            ? `${eligibility.asNine === "front" ? "Front" : "Back"} 9 complete`
            : `${scored}/${holeCount} scored`}
      </Text>
      <Button
        testID="live-finish"
        variant={eligible ? "default" : "outline"}
        onPress={onFinish}
      >
        Finish round
      </Button>
    </View>
  );
}
