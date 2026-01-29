import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingDown, TrendingUp, Minus, Trophy, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { ActivityItem } from "@/utils/activity-transform";

interface QuickStatsProps {
  activities: ActivityItem[];
  lowestDifferential: number | null;
  bestRoundDate?: Date | null;
  className?: string;
}

export function QuickStats({
  activities,
  lowestDifferential,
  bestRoundDate: bestRoundDateProp,
  className,
}: QuickStatsProps) {
  // Calculate stats from activities
  const recentActivities = activities.slice(0, 5);

  // Count improvements vs increases in last 5 rounds
  const handicapChanges = recentActivities.filter(a => a.handicapChange !== 0);
  const improvements = handicapChanges.filter(a => a.handicapChange < 0).length;
  const increases = handicapChanges.filter(a => a.handicapChange > 0).length;

  // Get the most recent round date
  const lastRoundDate = activities.length > 0
    ? new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(activities[0].date)
    : null;

  // Use the best round date from props (fetched from DB across all rounds)
  // Fall back to computing from activities if prop not provided
  const fallbackBestRoundDate = activities.length > 0
    ? activities.reduce((best, activity) =>
        activity.scoreDifferential < best.scoreDifferential ? activity : best
      ).date
    : null;

  const bestRoundDateToUse = bestRoundDateProp ?? fallbackBestRoundDate;

  const bestRoundDate = bestRoundDateToUse
    ? new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(bestRoundDateToUse)
    : null;

  return (
    <Card className={cn("", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">At a Glance</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Lowest Differential */}
        {lowestDifferential !== null && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Trophy className="h-4 w-4 text-yellow-500" />
              <span>Best Differential</span>
            </div>
            <span className="text-sm font-semibold text-foreground">
              {lowestDifferential.toFixed(1)}
            </span>
          </div>
        )}

        {/* Last Round Date */}
        {lastRoundDate && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>Last Round</span>
            </div>
            <span className="text-sm font-medium text-foreground">
              {lastRoundDate}
            </span>
          </div>
        )}

        {/* Recent Trend */}
        {handicapChanges.length > 0 && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {improvements > increases ? (
                <TrendingDown className="h-4 w-4 text-green-500" />
              ) : improvements < increases ? (
                <TrendingUp className="h-4 w-4 text-red-500" />
              ) : (
                <Minus className="h-4 w-4" />
              )}
              <span>Recent Trend</span>
            </div>
            <span
              className={cn(
                "text-sm font-medium",
                improvements > increases
                  ? "text-green-600 dark:text-green-400"
                  : improvements < increases
                    ? "text-red-600 dark:text-red-400"
                    : "text-foreground"
              )}
            >
              {improvements > increases
                ? `${improvements} improving`
                : improvements < increases
                  ? `${increases} rising`
                  : "Stable"}
            </span>
          </div>
        )}

        {/* Personal Best Date */}
        {bestRoundDate && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Trophy className="h-4 w-4 text-primary" />
              <span>Personal Best</span>
            </div>
            <span className="text-sm font-medium text-foreground">
              {bestRoundDate}
            </span>
          </div>
        )}

        {/* Empty state */}
        {activities.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-2">
            Log rounds to see your stats
          </p>
        )}
      </CardContent>
    </Card>
  );
}
