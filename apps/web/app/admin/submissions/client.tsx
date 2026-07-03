"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Loader2 } from "lucide-react";
import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FormFeedback } from "@/components/ui/form-feedback";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { PendingSubmission } from "@/server/api/routers/admin";
import type { FeedbackState } from "@/types/feedback";

const SUBMISSION_TYPE_LABEL: Record<PendingSubmission["submissionType"], string> = {
  new_course: "New course",
  new_tee: "New tee",
  tee_edit: "Tee edit",
};

const REJECTION_REASON_MIN_LENGTH = 3;

type PendingAction = {
  submission: PendingSubmission;
  action: "approve" | "reject";
};

export function SubmissionsQueueClient({
  initialData,
}: {
  initialData: PendingSubmission[];
}) {
  const utils = api.useUtils();
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const { data: submissions } = api.admin.listPendingSubmissions.useQuery(
    undefined,
    { initialData }
  );

  const approveMutation = api.admin.approveSubmission.useMutation({
    onSuccess: async () => {
      setFeedback({ type: "success", message: "Submission approved." });
      setPendingAction(null);
      await utils.admin.listPendingSubmissions.invalidate();
    },
    onError: (error) => {
      setFeedback({ type: "error", message: error.message });
    },
  });

  const rejectMutation = api.admin.rejectSubmission.useMutation({
    onSuccess: async () => {
      setFeedback({ type: "success", message: "Submission rejected." });
      setPendingAction(null);
      setRejectReason("");
      await utils.admin.listPendingSubmissions.invalidate();
    },
    onError: (error) => {
      setFeedback({ type: "error", message: error.message });
    },
  });

  const isMutating = approveMutation.isPending || rejectMutation.isPending;
  const trimmedReason = rejectReason.trim();
  const isReasonValid = trimmedReason.length >= REJECTION_REASON_MIN_LENGTH;

  const handleConfirm = () => {
    if (!pendingAction) return;

    const { submission, action } = pendingAction;
    if (action === "approve") {
      approveMutation.mutate({ submissionId: submission.id });
    } else {
      if (!isReasonValid) return;
      rejectMutation.mutate({
        submissionId: submission.id,
        reason: trimmedReason,
      });
    }
  };

  const handleDialogOpenChange = (open: boolean) => {
    if (!open && !isMutating) {
      setPendingAction(null);
      setRejectReason("");
    }
  };

  return (
    <div className="space-y-md">
      {feedback && (
        <FormFeedback
          type={feedback.type}
          message={feedback.message}
          onClose={() => setFeedback(null)}
        />
      )}

      {submissions.length === 0 ? (
        <p className="text-body-sm text-muted-foreground">
          No pending submissions.
        </p>
      ) : (
        <div className="surface">
          <Table>
            <caption className="sr-only">Pending course and tee submissions</caption>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">Type</TableHead>
                <TableHead scope="col">Course</TableHead>
                <TableHead scope="col">Tee</TableHead>
                <TableHead scope="col">Submitter</TableHead>
                <TableHead scope="col">Age</TableHead>
                <TableHead scope="col">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {submissions.map((submission) => (
                <TableRow key={submission.id}>
                  <TableCell>
                    <Badge variant="secondary">
                      {SUBMISSION_TYPE_LABEL[submission.submissionType]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {submission.courseName ?? (
                      <span className="text-muted-foreground">Unknown</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {submission.teeName ? (
                      <>
                        {submission.teeName}
                        {submission.teeGender ? ` (${submission.teeGender})` : ""}
                      </>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {submission.submitterEmail ??
                      submission.submitterId ?? (
                        <span className="text-muted-foreground">Unknown</span>
                      )}
                  </TableCell>
                  <TableCell>
                    <time dateTime={submission.createdAt}>
                      {formatDistanceToNow(new Date(submission.createdAt), {
                        addSuffix: true,
                      })}
                    </time>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-sm">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setPendingAction({ submission, action: "reject" })
                        }
                        aria-label={`Reject submission ${submission.id}`}
                      >
                        Reject
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() =>
                          setPendingAction({ submission, action: "approve" })
                        }
                        aria-label={`Approve submission ${submission.id}`}
                      >
                        Approve
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog
        open={pendingAction !== null}
        onOpenChange={handleDialogOpenChange}
      >
        <DialogContent className="sm:max-w-md">
          {pendingAction && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {pendingAction.action === "approve"
                    ? "Approve this submission?"
                    : "Reject this submission?"}
                </DialogTitle>
                <DialogDescription>
                  {SUBMISSION_TYPE_LABEL[pendingAction.submission.submissionType]}
                  {" — "}
                  {pendingAction.submission.courseName ?? "Unknown course"}
                  {pendingAction.submission.teeName
                    ? ` · ${pendingAction.submission.teeName}`
                    : ""}
                  {pendingAction.submission.teeGender
                    ? ` (${pendingAction.submission.teeGender})`
                    : ""}
                  . Submitted by{" "}
                  {pendingAction.submission.submitterEmail ??
                    pendingAction.submission.submitterId ??
                    "an unknown user"}
                  .
                </DialogDescription>
              </DialogHeader>
              {pendingAction.action === "reject" && (
                <div className="space-y-sm">
                  <Label htmlFor="reject-reason">Reason shown to the user</Label>
                  <Textarea
                    id="reject-reason"
                    value={rejectReason}
                    onChange={(event) => setRejectReason(event.target.value)}
                    placeholder="e.g. Tee ratings don't match the course's official scorecard."
                    rows={3}
                    disabled={isMutating}
                    aria-required="true"
                    aria-invalid={!isReasonValid}
                  />
                  {!isReasonValid && rejectReason.length > 0 && (
                    <p className="text-body-sm text-destructive">
                      Reason must be at least {REJECTION_REASON_MIN_LENGTH}{" "}
                      characters.
                    </p>
                  )}
                </div>
              )}
              <DialogFooter className="gap-sm sm:gap-0">
                <DialogClose asChild>
                  <Button variant="outline" disabled={isMutating}>
                    Cancel
                  </Button>
                </DialogClose>
                <Button
                  variant={
                    pendingAction.action === "reject" ? "destructive" : "default"
                  }
                  onClick={handleConfirm}
                  disabled={
                    isMutating ||
                    (pendingAction.action === "reject" && !isReasonValid)
                  }
                >
                  {isMutating ? (
                    <>
                      <Loader2 className="mr-sm h-4 w-4 animate-spin" />
                      {pendingAction.action === "approve"
                        ? "Approving..."
                        : "Rejecting..."}
                    </>
                  ) : pendingAction.action === "approve" ? (
                    "Approve"
                  ) : (
                    "Reject"
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
