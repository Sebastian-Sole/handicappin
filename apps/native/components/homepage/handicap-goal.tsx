/**
 * Native HandicapGoal — mirror of apps/web/components/homepage/
 * handicap-goal.tsx ("Journey to Scratch" progress card).
 */
import { Target } from "lucide-react-native";
import { Text, View } from "react-native";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { tokens } from "@handicappin/tokens/tokens";
import { useColorMode } from "@/lib/color-mode";
import { cn } from "@/lib/utils";

const ICON_SIZE = 16; // allow-hardcoded lucide icon prop mirrors web's fixed h-4 w-4 icon box

interface HandicapGoalProps {
  currentHandicap: number;
  startingHandicap: number;
  className?: string;
}

export function HandicapGoal({
  currentHandicap,
  startingHandicap,
  className,
}: HandicapGoalProps) {
  const mode = useColorMode();
  const progress =
    startingHandicap > 0
      ? Math.max(
          0,
          Math.min(
            100,
            ((startingHandicap - currentHandicap) / startingHandicap) * 100,
          ),
        )
      : 0;

  const improvement = startingHandicap - currentHandicap;
  const isImproving = improvement > 0;

  return (
    <Card className={className}>
      <CardHeader className="pb-sm">
        <View className="flex-row items-center gap-sm">
          <Target size={ICON_SIZE} color={tokens.colors[mode].primary} />
          <Text className="text-heading-4 text-foreground">
            Journey to Scratch
          </Text>
        </View>
      </CardHeader>
      <CardContent>
        <View className="gap-sm">
          <Progress value={progress} />
          <View className="flex-row justify-between">
            <Text className="text-meta text-muted-foreground">
              Start: {startingHandicap.toFixed(1)}
            </Text>
            <Text
              className={cn(
                "text-meta",
                isImproving ? "text-success" : "text-foreground",
              )}
            >
              {isImproving
                ? `${improvement.toFixed(1)} improved`
                : currentHandicap.toFixed(1)}
            </Text>
            <Text className="text-meta text-muted-foreground">
              Scratch: 0.0
            </Text>
          </View>
        </View>
      </CardContent>
    </Card>
  );
}
