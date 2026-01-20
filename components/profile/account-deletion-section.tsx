"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { REGEXP_ONLY_DIGITS } from "input-otp";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Trash2, Loader2, AlertTriangle } from "lucide-react";
import { api } from "@/trpc/react";
import { useRouter } from "next/navigation";
import { FormFeedback } from "@/components/ui/form-feedback";
import type { FeedbackState } from "@/types/feedback";

type DeletionStep = "initial" | "verify-otp";

export function AccountDeletionSection() {
  const [step, setStep] = useState<DeletionStep>("initial");
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const router = useRouter();

  const requestDeletionMutation = api.account.requestDeletion.useMutation({
    onSuccess: (data) => {
      setExpiresAt(data.expiresAt);
      setStep("verify-otp");
      setIsLoading(false);
      setFeedback({
        type: "info",
        message: "Verification code sent. Check your email for the 6-digit code.",
      });
    },
    onError: (error) => {
      setIsLoading(false);
      setFeedback({
        type: "error",
        message: error.message,
      });
    },
  });

  const confirmDeletionMutation = api.account.confirmDeletion.useMutation({
    onSuccess: () => {
      setFeedback({
        type: "success",
        message: "Account deleted. Redirecting...",
      });
      setTimeout(() => {
        router.push("/");
      }, 1500);
    },
    onError: (error) => {
      setIsLoading(false);
      setFeedback({
        type: "error",
        message: error.message,
      });
    },
  });

  const cancelDeletionMutation = api.account.cancelDeletion.useMutation();

  const handleRequestDeletion = () => {
    setIsLoading(true);
    setFeedback(null);
    requestDeletionMutation.mutate();
  };

  const handleVerifyOtp = () => {
    if (otp.length !== 6) {
      setFeedback({
        type: "error",
        message: "Please enter the 6-digit verification code.",
      });
      return;
    }
    setIsLoading(true);
    setFeedback(null);
    confirmDeletionMutation.mutate({ otp });
  };

  const handleCancel = () => {
    cancelDeletionMutation.mutate();
    setStep("initial");
    setOtp("");
    setExpiresAt(null);
    setFeedback(null);
    setDialogOpen(false);
  };

  const handleDialogOpenChange = (open: boolean) => {
    if (!open) {
      // Reset state when closing
      if (step === "verify-otp") {
        cancelDeletionMutation.mutate();
      }
      setStep("initial");
      setOtp("");
      setExpiresAt(null);
      setIsLoading(false);
      setFeedback(null);
    }
    setDialogOpen(open);
  };

  return (
    <div className="bg-card rounded-lg border border-destructive/20 p-6">
      <div className="flex items-start gap-3 mb-4">
        <AlertTriangle className="h-6 w-6 text-destructive flex-shrink-0 mt-0.5" />
        <div>
          <h3 className="text-xl font-semibold text-destructive">Delete Account</h3>
          <p className="text-muted-foreground mt-1">
            Permanently delete your account and all associated data. This action cannot be undone.
          </p>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
        <DialogTrigger asChild>
          <Button variant="destructive">
            <Trash2 className="mr-2 h-4 w-4" />
            Delete Account
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          {/* Inline feedback display */}
          {feedback && (
            <FormFeedback
              type={feedback.type}
              message={feedback.message}
              className="mb-2"
            />
          )}
          {step === "initial" && (
            <>
              <DialogHeader>
                <DialogTitle className="text-destructive">Are you absolutely sure?</DialogTitle>
                <DialogDescription>
                  This will permanently delete your account and all associated data.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>This includes:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Your profile and handicap history</li>
                  <li>All your rounds and scores</li>
                  <li>Your notification preferences</li>
                  <li>Any active subscriptions (will be cancelled)</li>
                </ul>
                <p className="font-medium text-destructive">
                  This action cannot be undone.
                </p>
              </div>
              <DialogFooter className="gap-2 sm:gap-0">
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <Button
                  variant="destructive"
                  onClick={handleRequestDeletion}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending code...
                    </>
                  ) : (
                    "Continue"
                  )}
                </Button>
              </DialogFooter>
            </>
          )}

          {step === "verify-otp" && (
            <>
              <DialogHeader>
                <DialogTitle className="text-destructive">Enter verification code</DialogTitle>
                <DialogDescription>
                  We sent a 6-digit code to your email. Enter it below to confirm deletion.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label
                    id="deletion-otp-label"
                    htmlFor="deletion-otp-input"
                    className="text-destructive font-medium"
                  >
                    Verification Code
                  </Label>
                  <div
                    className="flex justify-center"
                    role="group"
                    aria-labelledby="deletion-otp-label"
                  >
                    <InputOTP
                      id="deletion-otp-input"
                      maxLength={6}
                      pattern={REGEXP_ONLY_DIGITS}
                      inputMode="numeric"
                      value={otp}
                      onChange={(value) => setOtp(value)}
                      disabled={isLoading}
                      aria-label="Enter 6-digit account deletion verification code"
                      aria-required="true"
                    >
                      <InputOTPGroup>
                        <InputOTPSlot index={0} aria-label="Digit 1 of 6" />
                        <InputOTPSlot index={1} aria-label="Digit 2 of 6" />
                        <InputOTPSlot index={2} aria-label="Digit 3 of 6" />
                        <InputOTPSlot index={3} aria-label="Digit 4 of 6" />
                        <InputOTPSlot index={4} aria-label="Digit 5 of 6" />
                        <InputOTPSlot index={5} aria-label="Digit 6 of 6" />
                      </InputOTPGroup>
                    </InputOTP>
                  </div>
                  {expiresAt && (
                    <p className="text-xs text-muted-foreground text-center">
                      Code expires at {new Date(expiresAt).toLocaleTimeString()}
                    </p>
                  )}
                </div>
              </div>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  variant="outline"
                  onClick={handleCancel}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleVerifyOtp}
                  disabled={isLoading || otp.length !== 6}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    "Delete My Account"
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
