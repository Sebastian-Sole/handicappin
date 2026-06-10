/**
 * Native ActivityFeed — mirror of apps/web/components/homepage/
 * activity-feed.tsx (timeline of recent rounds with status dots, personal
 * best badges, milestones). Web's hover tooltip on the status dot has no
 * touch equivalent — the dot carries an accessibility label instead.
 */
import { router } from "expo-router";
import type { Href } from "expo-router";
import { ChevronRight, Trophy } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatDelta } from "@/components/ui/stat-delta";
import { tokens } from "@handicappin/tokens/tokens";
import type { ActivityItem } from "@/lib/activity-transform";
import { useColorMode } from "@/lib/color-mode";
import { cn } from "@/lib/utils";

const TROPHY_SIZE = 12; // allow-hardcoded lucide icon prop mirrors web's fixed h-3 w-3 icon box
const CHEVRON_SIZE = 16; // allow-hardcoded lucide icon prop mirrors web's fixed h-4 w-4 icon box

interface ActivityFeedProps {
  activities: ActivityItem[];
  profileId: string;
  className?: string;
}

const dateFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

export function ActivityFeed({
  activities,
  profileId,
  className,
}: ActivityFeedProps) {
  const mode = useColorMode();

  if (activities.length === 0) {
    return (
      <Card className={className} testID="activity-feed">
        <CardHeader>
          <Text className="text-heading-4 text-foreground">
            Recent Activity
          </Text>
        </CardHeader>
        <CardContent>
          <EmptyState
            title="No rounds logged yet"
            description="Start your golf journey!"
            action={
              <Button onPress={() => router.push("/rounds/add" as Href)}>
                Log Your First Round
              </Button>
            }
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className} testID="activity-feed">
      <CardHeader className="flex-row items-center justify-between pb-sm">
        <Text className="text-heading-4 text-foreground">Recent Activity</Text>
        <Pressable
          accessibilityRole="link"
          // typed-routes-forward-cast: target lands next cluster
          onPress={() => router.push(`/dashboard/${profileId}` as Href)}
        >
          <Text className="text-body-sm text-primary">View All</Text>
        </Pressable>
      </CardHeader>
      <CardContent className="pt-0">
        <View className="gap-xs">
          {activities.slice(0, 5).map((activity, index) => (
            <ActivityItemRow
              key={activity.id}
              activity={activity}
              isLast={index === activities.length - 1 || index === 4}
              chevronColor={tokens.colors[mode]["muted-foreground"]}
              warningColor={tokens.colors[mode].warning}
            />
          ))}
        </View>
      </CardContent>
    </Card>
  );
}

function ActivityItemRow({
  activity,
  isLast,
  chevronColor,
  warningColor,
}: {
  activity: ActivityItem;
  isLast: boolean;
  chevronColor: string;
  warningColor: string;
}) {
  const formattedDate = dateFormat.format(activity.date);
  const statusLabel =
    activity.approvalStatus === "approved"
      ? "Approved round"
      : activity.approvalStatus === "rejected"
        ? "Round rejected"
        : "Round pending approval";

  return (
    <Pressable
      accessibilityRole="button"
      // typed-routes-forward-cast: target lands next cluster
      onPress={() => router.push(`/rounds/${activity.id}/calculation` as Href)}
      className="flex-row items-start gap-sm p-sm rounded-lg active:opacity-80"
    >
      {/* Timeline dot — green approved, yellow pending, red rejected. */}
      <View className="items-center self-stretch">
        <View
          accessibilityLabel={statusLabel}
          className={cn(
            "w-2.5 h-2.5 rounded-full mt-sm",
            activity.approvalStatus === "approved"
              ? "bg-chart-1"
              : activity.approvalStatus === "rejected"
                ? "bg-destructive"
                : "bg-chart-5",
          )}
        />
        {!isLast ? (
          <View className="w-px flex-1 bg-border mt-xs" />
        ) : null}
      </View>

      <View className="flex-1">
        <View className="flex-row items-center justify-between gap-xs">
          <View className="flex-row items-center gap-xs flex-1">
            <Text
              className="text-label-sm text-foreground flex-shrink"
              numberOfLines={1}
            >
              {activity.courseName}
            </Text>
            {activity.isPersonalBest ? (
              <Badge variant="outline" className="tint-warning border px-xs">
                <View className="flex-row items-center gap-xs">
                  <Trophy size={TROPHY_SIZE} color={warningColor} />
                  <Text className="text-meta text-warning">Best</Text>
                </View>
              </Badge>
            ) : null}
          </View>
          <Text className="text-meta text-muted-foreground">
            {formattedDate}
          </Text>
        </View>

        <View className="flex-row flex-wrap items-center gap-sm mt-xs">
          <Text className="text-body-sm text-muted-foreground">
            Score:{" "}
            <Text className="text-body-sm text-foreground font-medium">
              {activity.score}
            </Text>
          </Text>
          <Text className="text-body-sm text-muted-foreground">
            Diff:{" "}
            <Text className="text-body-sm text-foreground font-medium">
              {activity.scoreDifferential.toFixed(1)}
            </Text>
          </Text>
          {activity.handicapChange !== 0 ? (
            <StatDelta value={activity.handicapChange} invert />
          ) : null}
        </View>

        {activity.isMilestone ? (
          <View className="flex-row mt-sm">
            <Badge variant="outline">
              <Text className="text-meta text-foreground">
                {activity.isMilestone}
              </Text>
            </Badge>
          </View>
        ) : null}
      </View>

      <View className="mt-sm">
        <ChevronRight size={CHEVRON_SIZE} color={chevronColor} />
      </View>
    </Pressable>
  );
}
