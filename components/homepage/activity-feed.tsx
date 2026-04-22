"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatDelta } from "@/components/ui/stat-delta";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Trophy, ChevronRight } from "lucide-react";
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
          <div className="text-center justify-center items-center flex flex-col py-xl">
            <p className="text-muted-foreground mb-md">
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
      <CardHeader className="flex flex-row items-center justify-between pb-sm">
        <CardTitle className="text-lg">Recent Activity</CardTitle>
        <Link
          href={`/dashboard/${profileId}`}
          className="text-sm text-primary hover:underline"
        >
          View All
        </Link>
      </CardHeader>
      <CardContent className="pt-0">
        <TooltipProvider delayDuration={150}>
          <div className="space-y-xs">
            {activities.slice(0, 5).map((activity, index) => (
              <ActivityItemRow
                key={activity.id}
                activity={activity}
                isLast={index === activities.length - 1 || index === 4}
              />
            ))}
          </div>
        </TooltipProvider>
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
          "flex items-start gap-sm p-sm -mx-sm rounded-lg",
          "hover:bg-accent/50 transition-colors cursor-pointer",
          "group",
        )}
      >
        {/* Timeline indicator — green = approved, yellow = pending, red = rejected */}
        <div className="flex flex-col items-center">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={(event) => event.preventDefault()}
                aria-label={
                  activity.approvalStatus === "approved"
                    ? "Approved round"
                    : activity.approvalStatus === "rejected"
                      ? "Round rejected"
                      : "Round pending approval"
                }
                className={cn(
                  "w-2.5 h-2.5 rounded-full mt-sm ring-2 ring-background cursor-default",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  activity.approvalStatus === "approved"
                    ? "bg-chart-1"
                    : activity.approvalStatus === "rejected"
                      ? "bg-destructive"
                      : "bg-chart-5",
                )}
              />
            </TooltipTrigger>
            <TooltipContent side="right">
              {activity.approvalStatus === "approved"
                ? "Approved round"
                : activity.approvalStatus === "rejected"
                  ? "Round rejected"
                  : "Round pending approval"}
            </TooltipContent>
          </Tooltip>
          {!isLast && <div className="w-px h-full bg-border flex-1 mt-xs" />}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 overflow-hidden">
          {/* Course name and date row */}
          <div className="flex items-center justify-between gap-xs sm:gap-sm">
            <div className="flex items-center gap-xs sm:gap-sm min-w-0 flex-1">
              <span className="font-medium text-sm truncate max-w-[120px] sm:max-w-none">
                {activity.courseName}
              </span>
              {activity.isPersonalBest && (
                <Badge
                  variant="secondary"
                  className="bg-warning/20 text-warning text-xs shrink-0 px-xs.5 sm:px-sm"
                >
                  <Trophy className="h-3 w-3 sm:mr-xs" />
                  <span className="hidden sm:inline">Best</span>
                </Badge>
              )}
            </div>
            <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
              {formattedDate}
            </span>
          </div>

          {/* Stats row - wraps on very small screens */}
          <div className="flex flex-wrap items-center gap-sm sm:gap-md mt-xs text-sm">
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
              <StatDelta
                value={activity.handicapChange}
                invert
                className="text-xs font-medium [&>svg]:h-3 [&>svg]:w-3"
              />
            )}
          </div>

          {activity.isMilestone && (
            <Badge variant="outline" className="mt-sm text-xs">
              {activity.isMilestone}
            </Badge>
          )}
        </div>

        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity mt-sm" />
      </div>
    </Link>
  );
}
