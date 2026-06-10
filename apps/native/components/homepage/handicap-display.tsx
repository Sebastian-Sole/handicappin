/**
 * Native HandicapDisplay — mirror of apps/web/components/homepage/
 * handicap-display.tsx (count-up figure + change pill).
 */
import { ArrowDown, ArrowUp } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";

import { tokens } from "@handicappin/tokens/tokens";
import { useColorMode } from "@/lib/color-mode";
import { cn } from "@/lib/utils";

const ICON_SIZE = 16; // allow-hardcoded lucide icon prop mirrors web's fixed h-4 w-4 icon box

interface HandicapDisplayProps {
  handicapIndex: number;
  previousHandicapIndex?: number;
  className?: string;
}

export function HandicapDisplay({
  handicapIndex,
  previousHandicapIndex,
  className,
}: HandicapDisplayProps) {
  const mode = useColorMode();
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const duration = 1000;
    const steps = 60;
    const increment = handicapIndex / steps;
    let current = 0;
    let stepCount = 0;

    const timer = setInterval(() => {
      stepCount++;
      current += increment;
      if (stepCount >= steps) {
        setDisplayValue(handicapIndex);
        clearInterval(timer);
      } else {
        setDisplayValue(Math.round(current * 10) / 10);
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [handicapIndex]);

  const hasPreviousHandicap =
    previousHandicapIndex !== undefined && previousHandicapIndex !== null;
  const change = hasPreviousHandicap
    ? handicapIndex - previousHandicapIndex
    : 0;
  const absoluteChange = Math.abs(change).toFixed(1);

  return (
    <View className={cn("items-center", className)}>
      <Text className="text-eyebrow-sm text-muted-foreground mb-sm">
        Handicap Index
      </Text>
      <Text className="text-figure-3xl text-foreground">
        {displayValue.toFixed(1)}
      </Text>
      {hasPreviousHandicap && change !== 0 ? (
        <View
          className={cn(
            "flex-row items-center gap-xs mt-sm px-sm py-xs rounded-full",
            change < 0 ? "tint-success" : "tint-destructive",
          )}
        >
          {change < 0 ? (
            <ArrowDown
              size={ICON_SIZE}
              color={tokens.colors[mode].success}
            />
          ) : (
            <ArrowUp
              size={ICON_SIZE}
              color={tokens.colors[mode].destructive}
            />
          )}
          <Text
            className={cn(
              "text-label-sm",
              change < 0 ? "text-success" : "text-destructive",
            )}
          >
            {absoluteChange} from first round
          </Text>
        </View>
      ) : null}
    </View>
  );
}
