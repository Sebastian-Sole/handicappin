import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trophy, TrendingDown, TrendingUp, ChevronRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { ActivityItem } from "@/utils/activity-transform";

interface ActivityFeedProps {
  activities: ActivityItem[];
  profileId: string;
  className?: string;
}

export function ActivityFeed({
  activities,
  profileId,
  className,
}: ActivityFeedProps) {
  if (activities.length === 0) {
    return (
      <Card className={cn("", className)}>
        <CardHeader>
          <CardTitle className="text-lg">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center justify-center items-center flex flex-col py-8">
            <p className="text-muted-foreground mb-4">
              No rounds logged yet. Start your golf journey!
            </p>
            <Link href="/rounds/add">
              <Button>Log Your First Round</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("", className)}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg">Recent Activity</CardTitle>
        <Link
          href={`/dashboard/${profileId}`}
          className="text-sm text-primary hover:underline"
        >
          View All
        </Link>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-1">
          {activities.slice(0, 5).map((activity, index) => (
            <ActivityItemRow
              key={activity.id}
              activity={activity}
              isLast={index === activities.length - 1 || index === 4}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ActivityItemRow({
  activity,
  isLast,
}: {
  activity: ActivityItem;
  isLast: boolean;
}) {
  const formattedDate = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(activity.date);

  return (
    <Link href={`/rounds/${activity.id}/calculation`}>
      <div
        className={cn(
          "flex items-start gap-3 p-3 -mx-3 rounded-lg",
          "hover:bg-accent/50 transition-colors cursor-pointer",
          "group",
        )}
      >
        {/* Timeline indicator */}
        <div className="flex flex-col items-center">
          <div
            className={cn(
              "w-2 h-2 rounded-full mt-2",
              activity.isPersonalBest ? "bg-yellow-500" : "bg-primary",
            )}
          />
          {!isLast && <div className="w-px h-full bg-border flex-1 mt-1" />}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 overflow-hidden">
          {/* Course name and date row */}
          <div className="flex items-center justify-between gap-1 sm:gap-2">
            <div className="flex items-center gap-1 sm:gap-2 min-w-0 flex-1">
              <span className="font-medium text-sm truncate max-w-[120px] sm:max-w-none">
                {activity.courseName}
              </span>
              {activity.isPersonalBest && (
                <Badge
                  variant="secondary"
                  className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 text-xs shrink-0 px-1.5 sm:px-2"
                >
                  <Trophy className="h-3 w-3 sm:mr-1" />
                  <span className="hidden sm:inline">Best</span>
                </Badge>
              )}
            </div>
            <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
              {formattedDate}
            </span>
          </div>

          {/* Stats row - wraps on very small screens */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-1 text-sm">
            <span className="text-muted-foreground">
              Score:{" "}
              <span className="text-foreground font-medium">
                {activity.score}
              </span>
            </span>
            <span className="text-muted-foreground">
              Diff:{" "}
              <span className="text-foreground font-medium">
                {activity.scoreDifferential.toFixed(1)}
              </span>
            </span>
            {activity.handicapChange !== 0 && (
              <span
                className={cn(
                  "flex items-center gap-0.5",
                  activity.handicapChange < 0
                    ? "text-green-600 dark:text-green-400"
                    : "text-red-600 dark:text-red-400",
                )}
              >
                {activity.handicapChange < 0 ? (
                  <TrendingDown className="h-3 w-3" />
                ) : (
                  <TrendingUp className="h-3 w-3" />
                )}
                <span className="text-xs font-medium">
                  {activity.handicapChange > 0 ? "+" : ""}
                  {activity.handicapChange.toFixed(1)}
                </span>
              </span>
            )}
          </div>

          {activity.isMilestone && (
            <Badge variant="outline" className="mt-2 text-xs">
              {activity.isMilestone}
            </Badge>
          )}
        </div>

        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity mt-2" />
      </div>
    </Link>
  );
}
