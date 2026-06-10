/**
 * Verify session — native twin of apps/web/app/(auth)/auth/verify-session/
 * page.tsx + verify-session-content.tsx. Same machine: refresh the session
 * until the JWT billing claims appear (the custom access-token hook), retry
 * up to 3×, then route to onboarding (no plan) or the return target; failed
 * runs offer logout-and-retry. Web's server-side "no user → login" guard
 * becomes a session check here.
 */
import { Redirect, router, useLocalSearchParams } from "expo-router";
import type { Href } from "expo-router";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";

import { AuthFormShell } from "@/components/auth/auth-form-shell";
import { DataSettledMarker } from "@/components/data-settled";
import { Button } from "@/components/ui/button";
import { FormFeedback } from "@/components/ui/form-feedback";
import { H1 } from "@/components/ui/typography";
import { useSession } from "@/lib/auth/session-provider";
import { supabase } from "@/lib/supabase";

const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 2000;

type VerificationState = "verifying" | "retrying" | "failed" | "error";

function PulsingDots({ colorClass }: { colorClass: string }) {
  return (
    <View className="flex-row justify-center gap-sm">
      <View className={`w-3 h-3 rounded-full ${colorClass}`} />
      <View className={`w-3 h-3 rounded-full ${colorClass}`} />
      <View className={`w-3 h-3 rounded-full ${colorClass}`} />
    </View>
  );
}

export default function VerifySessionScreen() {
  const { session, initializing } = useSession();
  const params = useLocalSearchParams<{ returnTo?: string; error?: string }>();
  const [state, setState] = useState<VerificationState>("verifying");
  const [attemptCount, setAttemptCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(
    typeof params.error === "string" ? params.error : null,
  );

  const userId = session?.user.id;
  const returnTo =
    typeof params.returnTo === "string" && params.returnTo
      ? params.returnTo
      : userId
        ? `/dashboard/${userId}`
        : "/";

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    void (async () => {
      try {
        const { data, error } = await supabase.auth.refreshSession();
        if (cancelled) return;

        if (error) throw error;
        if (!data.session) throw new Error("No session returned");

        const billing = (
          data.session.user.app_metadata as Record<string, unknown> | undefined
        )?.["billing"] as Record<string, unknown> | undefined;

        if (!billing) {
          if (attemptCount < MAX_RETRY_ATTEMPTS - 1) {
            setState("retrying");
            await new Promise((resolve) =>
              setTimeout(resolve, RETRY_DELAY_MS),
            );
            if (!cancelled) setAttemptCount((c) => c + 1);
            return;
          }
          setState("failed");
          setErrorMessage(
            "Unable to verify your session after multiple attempts. Please try logging in again.",
          );
          return;
        }

        if (!billing["plan"]) {
          // typed-routes-forward-cast: target screen lands next cluster
          router.replace("/onboarding" as Href);
        } else {
          // typed-routes-forward-cast: returnTo targets land across clusters
          router.replace(returnTo as Href);
        }
      } catch (error) {
        if (cancelled) return;
        if (attemptCount < MAX_RETRY_ATTEMPTS - 1) {
          setState("retrying");
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
          if (!cancelled) setAttemptCount((c) => c + 1);
        } else {
          setState("error");
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "An unexpected error occurred",
          );
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [attemptCount, returnTo, userId]);

  if (initializing) return null;
  if (!session) {
    return <Redirect href="/login?error=session_expired" />;
  }

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace("/login?error=session_verification_failed");
  };

  return (
    <AuthFormShell testID="verify-session-screen">
      <DataSettledMarker settled={state === "failed" || state === "error"} />
      <View className="items-center gap-md">
        {state === "verifying" ? (
          <>
            <H1 className="mb-sm text-center">Verifying Your Session</H1>
            <Text className="text-body text-muted-foreground mb-lg text-center">
              Please wait while we verify your account...
            </Text>
            <PulsingDots colorClass="bg-info" />
          </>
        ) : null}

        {state === "retrying" ? (
          <>
            <H1 className="mb-sm text-center">Retrying...</H1>
            <Text className="text-body text-muted-foreground mb-sm text-center">
              Verification attempt {attemptCount + 1} of {MAX_RETRY_ATTEMPTS}
            </Text>
            <Text className="text-body-sm text-muted-foreground mb-lg text-center">
              This may take a few moments
            </Text>
            <PulsingDots colorClass="bg-warning" />
          </>
        ) : null}

        {state === "failed" || state === "error" ? (
          <>
            <H1 className="mb-sm text-center">Verification Failed</H1>
            {errorMessage ? (
              <FormFeedback type="error" message={errorMessage} />
            ) : null}
            <View className="w-full gap-sm">
              <Button
                className="w-full"
                onPress={() => {
                  void handleLogout();
                }}
              >
                Log Out and Try Again
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onPress={() => {
                  setState("verifying");
                  setAttemptCount(0);
                  setErrorMessage(null);
                }}
              >
                Retry Verification
              </Button>
            </View>
          </>
        ) : null}
      </View>
    </AuthFormShell>
  );
}
