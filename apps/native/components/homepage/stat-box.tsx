/**
 * Native StatBox — mirror of apps/web/components/homepage/statBox.tsx
 * (title + icon header, figure value, change badge, muted description).
 */
import type { ReactNode } from "react";
import { Text, View } from "react-native";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatBoxProps {
  title: string;
  value: string;
  change: string;
  description?: string;
  icon: ReactNode;
}

const CHANGE_BADGE: Record<string, { box: string; text: string }> = {
  improvement: { box: "tint-success", text: "text-success" },
  achievement: { box: "tint-warning", text: "text-warning" },
  increase: { box: "tint-info", text: "text-info" },
  neutral: { box: "bg-muted border-muted", text: "text-muted-foreground" },
};

export function StatBox({
  title,
  value,
  change,
  description,
  icon,
}: StatBoxProps) {
  const badge = CHANGE_BADGE[change] ?? CHANGE_BADGE["neutral"]!;
  return (
    <Card className="border-0 p-lg flex-1">
      <View className="flex-row items-center justify-between pb-sm">
        <Text className="text-label-sm text-muted-foreground flex-1">
          {title}
        </Text>
        <View className="ml-sm">{icon}</View>
      </View>
      <Text className="text-figure text-foreground mb-xs">{value}</Text>
      <View className="flex-row mb-sm">
        {/* variant="outline" so the default variant's bg-primary can't fight
            the tint-* recipe — twMerge doesn't know tint-* is a background
            class, so under the default variant BOTH land and primary wins. */}
        <Badge variant="outline" className={cn("border", badge.box)}>
          <Text className={cn("text-meta", badge.text)}>{change}</Text>
        </Badge>
      </View>
      {description ? (
        <Text className="text-meta text-muted-foreground">{description}</Text>
      ) : null}
    </Card>
  );
}
