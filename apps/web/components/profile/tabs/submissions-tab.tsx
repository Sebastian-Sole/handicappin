"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { api } from "@/trpc/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { H2 } from "@/components/ui/typography";
import { FileEdit } from "lucide-react";
import type { MySubmission } from "@/server/api/routers/round";

const SUBMISSION_TYPE_LABEL: Record<MySubmission["submissionType"], string> = {
  new_course: "New course",
  new_tee: "New tee",
  tee_edit: "Tee edit",
};

const STATUS_BADGE_CLASS: Record<MySubmission["status"], string> = {
  pending: "tint-warning text-warning hover:text-warning",
  approved: "tint-success text-success hover:text-success",
  rejected: "tint-destructive text-destructive hover:text-destructive",
};

const STATUS_LABEL: Record<MySubmission["status"], string> = {
  pending: "Pending review",
  approved: "Approved",
  rejected: "Rejected",
};

export function SubmissionsTab() {
  const { data: submissions, isLoading } =
    api.round.listMySubmissions.useQuery(undefined, {
      refetchOnWindowFocus: false,
    });

  return (
    <div className="space-y-lg">
      <div>
        <H2 className="text-heading-3 mb-sm">My Submissions</H2>
        <p className="text-muted-foreground">
          Course and tee data you&apos;ve submitted, and its review status
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-md">
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-24 w-full rounded-lg" />
        </div>
      ) : !submissions || submissions.length === 0 ? (
        <div className="surface p-lg">
          <EmptyState
            icon={<FileEdit className="h-5 w-5" />}
            title="No submissions yet"
            description="When you add a new course or tee while logging a round, it'll show up here for review."
          />
        </div>
      ) : (
        <ul className="space-y-md">
          {submissions.map((submission) => (
            <li key={submission.id} className="surface p-lg space-y-sm">
              <div className="flex flex-wrap items-center justify-between gap-sm">
                <div className="flex flex-wrap items-center gap-sm">
                  <Badge variant="secondary">
                    {SUBMISSION_TYPE_LABEL[submission.submissionType]}
                  </Badge>
                  <span className="text-label-sm">
                    {submission.courseName ?? "Unknown course"}
                    {submission.teeName ? ` · ${submission.teeName}` : ""}
                  </span>
                </div>
                <Badge
                  variant="outline"
                  className={STATUS_BADGE_CLASS[submission.status]}
                >
                  {STATUS_LABEL[submission.status]}
                </Badge>
              </div>

              <p className="text-body-sm text-muted-foreground">
                Submitted{" "}
                <time dateTime={submission.createdAt}>
                  {formatDistanceToNow(new Date(submission.createdAt), {
                    addSuffix: true,
                  })}
                </time>
                {submission.resolvedAt ? (
                  <>
                    {" "}
                    — resolved{" "}
                    <time dateTime={submission.resolvedAt}>
                      {formatDistanceToNow(new Date(submission.resolvedAt), {
                        addSuffix: true,
                      })}
                    </time>
                  </>
                ) : null}
              </p>

              {submission.status === "rejected" && (
                <div className="tint-destructive rounded-md p-sm space-y-sm">
                  {submission.rejectionReason ? (
                    <p className="text-body-sm text-foreground">
                      <span className="font-semibold">Reason: </span>
                      {submission.rejectionReason}
                    </p>
                  ) : (
                    <p className="text-body-sm text-muted-foreground">
                      No reason was recorded for this rejection.
                    </p>
                  )}
                  <Link href="/rounds/add">
                    <Button variant="link" size="sm" className="px-0 h-auto">
                      Fix and resubmit
                    </Button>
                  </Link>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
