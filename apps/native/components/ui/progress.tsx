/** Native Progress — mirror of apps/web/components/ui/progress.tsx. */
import { View } from "react-native";

import { cn } from "@/lib/utils";

export function Progress({
  value,
  className,
}: {
  /** 0–100. */
  value: number;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: clamped }}
      className={cn(
        "h-2 w-full overflow-hidden rounded-full bg-secondary",
        className,
      )}
    >
      <View
        className="h-full rounded-full bg-primary"
        style={{ width: `${clamped}%` }}
      />
    </View>
  );
}
