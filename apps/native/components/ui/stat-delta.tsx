/** Native StatDelta — mirror of apps/web/components/ui/stat-delta.tsx. */
import { Minus, TrendingDown, TrendingUp } from "lucide-react-native";
import { Text, View } from "react-native";

import { tokens } from "@handicappin/tokens/tokens";
import { useColorMode } from "@/lib/color-mode";
import { cn } from "@/lib/utils";

const ICON_SIZE = 16; // allow-hardcoded lucide icon prop mirrors web's fixed h-4 w-4 icon box

type StatDeltaProps = {
  value: number;
  /** Set when a negative delta is the "better" direction (golf). */
  invert?: boolean;
  threshold?: number;
  format?: (value: number) => string;
  className?: string;
  iconOnly?: boolean;
  numberOnly?: boolean;
};

const defaultFormat = (v: number) =>
  v > 0 ? `+${v.toFixed(1)}` : v.toFixed(1);

export function StatDelta({
  value,
  invert = false,
  threshold = 0,
  format = defaultFormat,
  className,
  iconOnly = false,
  numberOnly = false,
}: StatDeltaProps) {
  const mode = useColorMode();
  const isPositive = value > threshold;
  const isNegative = value < -threshold;
  const better = invert ? isNegative : isPositive;
  const worse = invert ? isPositive : isNegative;

  const toneClass = better
    ? "text-success"
    : worse
      ? "text-destructive"
      : "text-muted-foreground";
  const iconColor = better
    ? tokens.colors[mode].success
    : worse
      ? tokens.colors[mode].destructive
      : tokens.colors[mode]["muted-foreground"];

  const Icon = isPositive ? TrendingUp : isNegative ? TrendingDown : Minus;

  return (
    <View className={cn("flex-row items-center gap-xs", className)}>
      {!numberOnly ? <Icon size={ICON_SIZE} color={iconColor} /> : null}
      {!iconOnly ? (
        <Text className={cn("text-meta-strong", toneClass)}>
          {format(value)}
        </Text>
      ) : null}
    </View>
  );
}
