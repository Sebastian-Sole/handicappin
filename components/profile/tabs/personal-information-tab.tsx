"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tables } from "@/types/supabase";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { createClientComponentClient } from "@/utils/supabase/client";
import { User } from "@supabase/supabase-js";
import { api } from "@/trpc/react";
import { toast } from "@/components/ui/use-toast";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useSearchParams, useRouter } from "next/navigation";

interface PersonalInformationTabProps {
  authUser: User;
  profile: Tables<"profile">;
}

const updateProfileSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Name is required"),
  // Email is managed separately through email change workflow
});

// Helper hook for handling success query params
function useSuccessParam(
  paramName: string,
  setShowSuccess: (show: boolean) => void,
  authUserId: string,
  onSuccess?: () => void
) {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    if (searchParams.get(paramName) === "true") {
      setShowSuccess(true);
      onSuccess?.();

      // Remove the query param from URL
      const newParams = new URLSearchParams(searchParams.toString());
      newParams.delete(paramName);
      const newUrl = `/profile/${authUserId}?${newParams.toString()}`;
      router.replace(newUrl, { scroll: false });

      // Hide after 5 seconds
      const timer = setTimeout(() => setShowSuccess(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [paramName, searchParams, authUserId, router, setShowSuccess, onSuccess]);
}

export function PersonalInformationTab({
  profile,
  authUser,
}: PersonalInformationTabProps) {
  const { id, name: profileName } = profile;
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">(
    "idle"
  );
  const [isRequestingChange, setIsRequestingChange] = useState(false);
  const [showCancelSuccess, setShowCancelSuccess] = useState(false);
  const [showVerifySuccess, setShowVerifySuccess] = useState(false);
  const supabase = createClientComponentClient();
  const utils = api.useUtils();

  const { mutate } = api.auth.updateProfile.useMutation({
    onSuccess: () => {
      setSaveState("saved");

      // Reset button state after 2 seconds
      setTimeout(() => {
        setSaveState("idle");
      }, 2000);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      setSaveState("idle");
    },
  });

  // Fetch pending email change
  const { data: pendingChange } = api.auth.getPendingEmailChange.useQuery(
    undefined,
    {
      refetchOnWindowFocus: false,
    }
  );

  // Derive pendingEmail from query data instead of duplicating in state
  const pendingEmail = pendingChange?.new_email ?? null;

  const form = useForm<z.infer<typeof updateProfileSchema>>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: {
      id: id,
      name: profileName || "",
    },
  });

  // Reference to current email (not part of profile update)
  const currentEmail = authUser.email || "";
  const [newEmail, setNewEmail] = useState(authUser.email || "");

  // Handle success query params
  useSuccessParam("cancelled", setShowCancelSuccess, authUser.id);
  useSuccessParam("verified", setShowVerifySuccess, authUser.id, () => {
    utils.auth.getPendingEmailChange.invalidate();
  });

  const handleSubmit = async (values: z.infer<typeof updateProfileSchema>) => {
    setSaveState("saving");

    // Update name only - email is managed separately
    mutate({
      id,
      name: values.name,
    });
  };

  const handleEmailChange = async () => {
    // Check if email changed
    const emailChanged = newEmail !== currentEmail;

    if (!emailChanged) {
      toast({
        title: "No change",
        description: "Please enter a different email address",
      });
      return;
    }

    // Request email change
    setIsRequestingChange(true);
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const session = await supabase.auth.getSession();

      if (!session.data.session) {
        toast({
          title: "Error",
          description: "Session expired. Please log in again.",
          variant: "destructive",
        });
        setIsRequestingChange(false);
        return;
      }

      const response = await fetch(
        `${supabaseUrl}/functions/v1/request-email-change`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.data.session.access_token}`,
          },
          body: JSON.stringify({ newEmail }),
        }
      );

      const data = await response.json();

      if (response.ok && data.success) {
        toast({
          title: "Verification email sent",
          description:
            "Please check your new email address to verify the change.",
        });
        // Invalidate query to refetch actual backend state
        await utils.auth.getPendingEmailChange.invalidate();
        // Reset email field to current email
        setNewEmail(currentEmail);
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to request email change",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Email change request error:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsRequestingChange(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold mb-2">Personal Information</h2>
        <p className="text-muted-foreground">
          Manage your account details and preferences
        </p>
      </div>

      {/* Success alert for cancelled email change */}
      {showCancelSuccess && (
        <Alert className="bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800">
          <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
          <AlertDescription className="text-green-800 dark:text-green-200">
            Email change cancelled successfully. Your email address remains unchanged.
          </AlertDescription>
        </Alert>
      )}

      {/* Success alert for verified email change */}
      {showVerifySuccess && (
        <Alert className="bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800">
          <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
          <AlertDescription className="text-green-800 dark:text-green-200">
            Email address updated successfully!
          </AlertDescription>
        </Alert>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input id="name" type="text" required {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Email section - managed separately */}
          <div className="space-y-3">
            <FormLabel>Email</FormLabel>
            <div className="flex gap-2">
              <Input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="Enter new email"
              />
              <Button
                type="button"
                onClick={handleEmailChange}
                disabled={isRequestingChange || newEmail === currentEmail}
              >
                {isRequestingChange ? "Sending..." : "Change Email"}
              </Button>
            </div>
            {pendingEmail && (
              <Alert className="mt-2">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Pending verification:</strong> {pendingEmail}
                  <br />
                  <span className="text-sm text-muted-foreground">
                    Check your email to verify this change.
                  </span>
                </AlertDescription>
              </Alert>
            )}
            {!pendingEmail && (
              <p className="text-sm text-muted-foreground">
                A verification email will be sent to your new address.
              </p>
            )}
          </div>

          <div className="flex items-center justify-between pt-4">
            <Link href="/forgot-password">
              <Button variant="link" className="px-0">
                Change password?
              </Button>
            </Link>
            <Button
              type="submit"
              disabled={saveState === "saving" || saveState === "saved"}
              className={`transition-all duration-300 ${
                saveState === "saved"
                  ? "bg-green-600 hover:bg-green-600"
                  : saveState === "saving"
                  ? "bg-muted text-muted-foreground hover:bg-muted"
                  : ""
              }`}
            >
              {saveState === "saving" && (
                <span className="flex items-center gap-2">
                  <span className="animate-spin">⏳</span>
                  Saving...
                </span>
              )}
              {saveState === "saved" && (
                <span className="flex items-center gap-2">
                  <Check className="h-4 w-4" />
                  Saved!
                </span>
              )}
              {saveState === "idle" && "Save Changes"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
