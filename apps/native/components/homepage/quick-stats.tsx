/**
 * Native QuickStats — mirror of apps/web/components/homepage/quick-stats.tsx
 * ("At a Glance" card: best differential, last round, trend, personal best).
 */
import {
  Calendar,
  Minus,
  TrendingDown,
  TrendingUp,
  Trophy,
} from "lucide-react-native";
import { Text, View } from "react-native";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { tokens } from "@handicappin/tokens/tokens";
import type { ActivityItem } from "@/lib/activity-transform";
import { useColorMode } from "@/lib/color-mode";
import { cn } from "@/lib/utils";

const ICON_SIZE = 16; // allow-hardcoded lucide icon prop mirrors web's fixed h-4 w-4 icon box

interface QuickStatsProps {
  activities: ActivityItem[];
  lowestDifferential: number | null;
  bestRoundDate?: Date | null;
  className?: string;
}

const dateFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export function QuickStats({
  activities,
  lowestDifferential,
  bestRoundDate: bestRoundDateProp,
  className,
}: QuickStatsProps) {
  const mode = useColorMode();
  const recentActivities = activities.slice(0, 5);
  const handicapChanges = recentActivities.filter(
    (a) => a.handicapChange !== 0,
  );
  const improvements = handicapChanges.filter(
    (a) => a.handicapChange < 0,
  ).length;
  const increases = handicapChanges.filter((a) => a.handicapChange > 0).length;

  const lastRoundDate =
    activities.length > 0 && activities[0]
      ? dateFormat.format(activities[0].date)
      : null;

  const fallbackBestRoundDate =
    activities.length > 0
      ? activities.reduce((best, activity) =>
          activity.scoreDifferential < best.scoreDifferential
            ? activity
            : best,
        ).date
      : null;
  const bestRoundDateToUse = bestRoundDateProp ?? fallbackBestRoundDate;
  const bestRoundDate = bestRoundDateToUse
    ? dateFormat.format(bestRoundDateToUse)
    : null;

  const TrendIcon =
    improvements > increases
      ? TrendingDown
      : improvements < increases
        ? TrendingUp
        : Minus;
  const trendIconColor =
    improvements > increases
      ? tokens.colors[mode].success
      : improvements < increases
        ? tokens.colors[mode].destructive
        : tokens.colors[mode]["muted-foreground"];

  return (
    <Card className={className}>
      <CardHeader className="pb-sm">
        <Text className="text-heading-4 text-foreground">At a Glance</Text>
      </CardHeader>
      <CardContent className="gap-md">
        {lowestDifferential !== null ? (
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-sm">
              <Trophy size={ICON_SIZE} color={tokens.colors[mode].warning} />
              <Text className="text-body-sm text-muted-foreground">
                Best Differential
              </Text>
            </View>
            <Text className="text-badge text-foreground">
              {lowestDifferential.toFixed(1)}
            </Text>
          </View>
        ) : null}

        {lastRoundDate ? (
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-sm">
              <Calendar
                size={ICON_SIZE}
                color={tokens.colors[mode]["muted-foreground"]}
              />
              <Text className="text-body-sm text-muted-foreground">
                Last Round
              </Text>
            </View>
            <Text className="text-label-sm text-foreground">
              {lastRoundDate}
            </Text>
          </View>
        ) : null}

        {handicapChanges.length > 0 ? (
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-sm">
              <TrendIcon size={ICON_SIZE} color={trendIconColor} />
              <Text className="text-body-sm text-muted-foreground">
                Recent Trend
              </Text>
            </View>
            <Text
              className={cn(
                "text-label-sm",
                improvements > increases
                  ? "text-success"
                  : improvements < increases
                    ? "text-destructive"
                    : "text-foreground",
              )}
            >
              {improvements > increases
                ? `${improvements} improving`
                : improvements < increases
                  ? `${increases} rising`
                  : "Stable"}
            </Text>
          </View>
        ) : null}

        {bestRoundDate ? (
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-sm">
              <Trophy size={ICON_SIZE} color={tokens.colors[mode].primary} />
              <Text className="text-body-sm text-muted-foreground">
                Personal Best
              </Text>
            </View>
            <Text className="text-label-sm text-foreground">
              {bestRoundDate}
            </Text>
          </View>
        ) : null}

        {activities.length === 0 ? (
          <EmptyState
            size="compact"
            title="Log rounds to see your stats"
            className="py-sm"
          />
        ) : null}
      </CardContent>
    </Card>
  );
}
