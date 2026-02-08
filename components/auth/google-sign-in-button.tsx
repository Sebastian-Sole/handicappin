"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import * as Sentry from "@sentry/nextjs";
import { GoogleOAuthProvider, useGoogleLogin } from "@react-oauth/google";
import { Button } from "@/components/ui/button";
import { FormFeedback } from "@/components/ui/form-feedback";
import { createClientComponentClient } from "@/utils/supabase/client";
import { clientLogger } from "@/lib/client-logger";
import { getBillingFromJWT } from "@/utils/supabase/jwt";

interface GoogleSignInButtonProps {
  mode?: "login" | "signup";
  className?: string;
}

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!;
const MAX_NAME_LENGTH = 100;
const DEFAULT_NAME = "Golfer";
const DEFAULT_HANDICAP_INDEX = 54;

/**
 * Sanitizes and validates a name from OAuth metadata.
 */
function sanitizeName(rawName: string): string {
  const sanitized = rawName.replace(/<[^>]*>/g, "").trim();
  if (sanitized.length === 0 || sanitized.length > MAX_NAME_LENGTH) {
    return DEFAULT_NAME;
  }
  return sanitized;
}

/**
 * Google Sign-In Button Component
 *
 * Uses Google's auth-code flow via a custom styled button.
 * The Google popup displays the app name (from OAuth consent screen)
 * instead of the Supabase project domain. The auth code is exchanged
 * server-side for an ID token, then signed in via Supabase's signInWithIdToken.
 */
export function GoogleSignInButton({
  mode = "login",
  className,
}: GoogleSignInButtonProps) {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <GoogleSignInButtonContent mode={mode} className={className} />
    </GoogleOAuthProvider>
  );
}

function GoogleSignInButtonContent({
  mode = "login",
  className,
}: GoogleSignInButtonProps) {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const supabase = createClientComponentClient();

  const handleSignIn = useCallback(
    async (code: string) => {
      setIsLoading(true);
      setError(null);

      await Sentry.startSpan(
        { op: "auth.id_token", name: "Google ID Token Sign-In" },
        async (span) => {
          span.setAttribute("auth.provider", "google");
          span.setAttribute("auth.mode", mode);

          try {
            // Exchange auth code for ID token via our API
            const exchangeResponse = await fetch("/api/auth/google-token", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ code }),
            });

            if (!exchangeResponse.ok) {
              span.setStatus({ code: 2, message: "Token exchange failed" });
              setIsLoading(false);
              setError("Failed to sign in with Google. Please try again.");
              return;
            }

            const { id_token } = await exchangeResponse.json();

            // Sign in with Supabase using the Google ID token
            const { data, error: signInError } =
              await supabase.auth.signInWithIdToken({
                provider: "google",
                token: id_token,
              });

            if (signInError || !data.user) {
              span.setStatus({
                code: 2,
                message: signInError?.message ?? "No user returned",
              });
              Sentry.captureException(
                signInError ?? new Error("No user after signInWithIdToken"),
                { tags: { provider: "google", mode } }
              );
              clientLogger.error(
                "Google ID token sign-in failed",
                signInError
              );
              setIsLoading(false);
              setError("Failed to sign in with Google. Please try again.");
              return;
            }

            const user = data.user;
            span.setAttribute("auth.userId", user.id);

            if (!user.email) {
              span.setStatus({ code: 2, message: "No email from Google" });
              setIsLoading(false);
              setError("No email address found. Please try again.");
              return;
            }

            // Extract name from Google metadata
            const rawName =
              (user.user_metadata?.full_name as string) ||
              (user.user_metadata?.name as string) ||
              user.email?.split("@")[0] ||
              "";
            const fullName = sanitizeName(rawName);

            // Upsert profile (insert if new, no-op if exists)
            const { error: upsertError } = await supabase
              .from("profile")
              .upsert(
                {
                  id: user.id,
                  email: user.email,
                  name: fullName,
                  verified: true,
                  handicapIndex: DEFAULT_HANDICAP_INDEX,
                },
                { onConflict: "id", ignoreDuplicates: true }
              );

            if (upsertError) {
              Sentry.captureException(new Error(upsertError.message), {
                tags: { flow: "google_id_token", step: "profile_upsert" },
                extra: { code: upsertError.code, userId: user.id },
              });
              clientLogger.error("Profile upsert failed", upsertError);
            }

            // Determine redirect destination
            const {
              data: { session },
            } = await supabase.auth.getSession();
            const billing = getBillingFromJWT(session);

            if (!billing?.plan) {
              const { data: profile } = await supabase
                .from("profile")
                .select("plan_selected")
                .eq("id", user.id)
                .maybeSingle();

              if (!profile?.plan_selected) {
                span.setAttribute("auth.result", "new_or_no_plan");
                span.setStatus({ code: 1 });
                router.push("/onboarding");
                router.refresh();
                return;
              }
            }

            span.setAttribute("auth.result", "existing_user");
            span.setStatus({ code: 1 });
            router.push("/");
            router.refresh();
          } catch (caughtError) {
            span.setStatus({ code: 2, message: "Google sign-in failed" });
            Sentry.captureException(caughtError, {
              tags: { provider: "google", mode },
            });
            clientLogger.error("Google sign-in failed", caughtError);
            setIsLoading(false);
            setError("Something went wrong. Please try again.");
          }
        }
      );
    },
    [supabase, router, mode]
  );

  const login = useGoogleLogin({
    flow: "auth-code",
    onSuccess: (codeResponse) => {
      handleSignIn(codeResponse.code);
    },
    onError: (errorResponse) => {
      clientLogger.error("Google login error", errorResponse);
      setError("Google Sign-In failed. Please try again.");
    },
  });

  const buttonText = isLoading
    ? "Signing in..."
    : mode === "signup"
      ? "Sign up with Google"
      : "Sign in with Google";

  return (
    <>
      {error && (
        <FormFeedback
          type="error"
          message={error}
          onClose={() => setError(null)}
        />
      )}
      <Button
        type="button"
        variant="outline"
        className={className}
        onClick={() => login()}
        disabled={isLoading}
      >
        {/* Google "G" Logo SVG */}
        <svg
          className="mr-2 h-4 w-4"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            fill="#4285F4"
          />
          <path
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            fill="#34A853"
          />
          <path
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            fill="#FBBC05"
          />
          <path
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            fill="#EA4335"
          />
        </svg>
        {buttonText}
      </Button>
    </>
  );
}
