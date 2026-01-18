"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { useToast } from "@/components/ui/use-toast";
import { useRouter } from "next/navigation";

type DeletionStep = "initial" | "verify-otp";

export function AccountDeletionSection() {
  const [step, setStep] = useState<DeletionStep>("initial");
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const requestDeletionMutation = api.account.requestDeletion.useMutation({
    onSuccess: (data) => {
      setExpiresAt(data.expiresAt);
      setStep("verify-otp");
      setIsLoading(false);
      toast({
        title: "Verification code sent",
        description: "Check your email for the 6-digit code.",
      });
    },
    onError: (error) => {
      setIsLoading(false);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const confirmDeletionMutation = api.account.confirmDeletion.useMutation({
    onSuccess: () => {
      toast({
        title: "Account deleted",
        description: "Your account has been permanently deleted.",
      });
      router.push("/");
    },
    onError: (error) => {
      setIsLoading(false);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const cancelDeletionMutation = api.account.cancelDeletion.useMutation();

  const handleRequestDeletion = () => {
    setIsLoading(true);
    requestDeletionMutation.mutate();
  };

  const handleVerifyOtp = () => {
    if (otp.length !== 6) {
      toast({
        title: "Invalid code",
        description: "Please enter the 6-digit verification code.",
        variant: "destructive",
      });
      return;
    }
    setIsLoading(true);
    confirmDeletionMutation.mutate({ otp });
  };

  const handleCancel = () => {
    cancelDeletionMutation.mutate();
    setStep("initial");
    setOtp("");
    setExpiresAt(null);
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
                  <Label htmlFor="otp" className="text-destructive font-medium">
                    Verification Code
                  </Label>
                  <Input
                    id="otp"
                    type="text"
                    placeholder="Enter 6-digit code"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.toUpperCase().slice(0, 6))}
                    className="font-mono text-lg tracking-widest text-center"
                    maxLength={6}
                    autoComplete="one-time-code"
                  />
                  {expiresAt && (
                    <p className="text-xs text-muted-foreground">
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
