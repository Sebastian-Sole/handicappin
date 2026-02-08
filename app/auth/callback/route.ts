import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { Database } from "@/types/supabase";
import { logger } from "@/lib/logging";
import { env } from "@/env";
import { oauthCallbackRateLimit, getIdentifier } from "@/lib/rate-limit";

const MAX_NAME_LENGTH = 100;
const DEFAULT_NAME = "Golfer";

/**
 * Maps raw OAuth provider error parameters to safe, canonical error codes.
 * Prevents forwarding free-form provider text to the frontend.
 */
function mapOAuthErrorToCode(
  errorParam: string,
  errorDescription: string | null
): string {
  const param = errorParam.toLowerCase();
  const description = (errorDescription ?? "").toLowerCase();

  if (
    param === "access_denied" ||
    description.includes("cancelled") ||
    description.includes("canceled") ||
    description.includes("denied")
  ) {
    return "oauth_cancelled";
  }

  if (
    param === "unsupported_response_type" ||
    param === "unauthorized_client" ||
    description.includes("unsupported")
  ) {
    return "oauth_unsupported";
  }

  return "oauth_provider_error";
}

/**
 * Checks whether an OAuth provider has verified the user's email address.
 * Google includes `email_verified` in user_metadata, and Supabase sets
 * `email_confirmed_at` when the provider confirms the email. We check both
 * to be defensive: the email is only considered verified if at least one
 * source confirms it.
 */
function isEmailVerifiedByOAuthProvider(user: {
  user_metadata?: Record<string, unknown>;
  email_confirmed_at?: string | null;
}): boolean {
  return (
    user.user_metadata?.email_verified === true ||
    user.email_confirmed_at != null
  );
}

const oauthEmailSchema = z.string().email().min(3).max(255);

const oauthNameSchema = z
  .string()
  .max(MAX_NAME_LENGTH)
  .transform((value) => value.replace(/<[^>]*>/g, "").trim())
  .pipe(z.string().min(1));

/**
 * OAuth Callback Route Handler
 *
 * Handles the redirect from OAuth providers (Google) after user authentication.
 * This route:
 * 1. Exchanges the authorization code for a session
 * 2. Upserts the profile (insert if new, no-op if exists) to avoid race conditions
 * 3. Queries the profile to determine current state
 * 4. Redirects to /onboarding if no plan, else to /
 */
export async function GET(request: NextRequest) {
  return Sentry.startSpan(
    {
      op: "auth.callback",
      name: "OAuth Callback Handler",
    },
    async (span) => {
      const requestUrl = new URL(request.url);
      const origin = requestUrl.origin;

      // Rate limit by IP before any OAuth processing
      const identifier = getIdentifier(request);
      const { success: rateLimitSuccess, limit, remaining, reset } =
        await oauthCallbackRateLimit.limit(identifier);

      if (!rateLimitSuccess) {
        const retryAfterSeconds = Math.ceil((reset - Date.now()) / 1000);
        logger.warn("OAuth callback rate limit exceeded", {
          identifier,
          limit,
          remaining,
          reset: new Date(reset).toISOString(),
        });
        span.setStatus({ code: 2, message: "Rate limit exceeded" });
        span.setAttribute("rate_limit.exceeded", true);

        const redirectUrl = new URL(`${origin}/login`);
        redirectUrl.searchParams.set("error", "rate_limit_exceeded");
        const response = NextResponse.redirect(redirectUrl);
        response.headers.set("X-RateLimit-Limit", limit.toString());
        response.headers.set("X-RateLimit-Remaining", "0");
        response.headers.set("X-RateLimit-Reset", new Date(reset).toISOString());
        response.headers.set("Retry-After", retryAfterSeconds.toString());
        return response;
      }

      const code = requestUrl.searchParams.get("code");
      const errorParam = requestUrl.searchParams.get("error");
      const errorDescription = requestUrl.searchParams.get("error_description");

      // Handle OAuth errors (user cancelled, provider error, etc.)
      if (errorParam) {
        logger.warn("OAuth callback received error", {
          error: errorParam,
          description: errorDescription,
        });
        span.setStatus({ code: 2, message: "OAuth provider error" });
        span.setAttribute("oauth.error", errorParam);
        const errorCode = mapOAuthErrorToCode(errorParam, errorDescription);
        return NextResponse.redirect(
          `${origin}/login?error=${encodeURIComponent(errorCode)}`
        );
      }

      // No code means something went wrong
      if (!code) {
        logger.error("OAuth callback missing authorization code");
        span.setStatus({ code: 2, message: "Missing authorization code" });
        return NextResponse.redirect(
          `${origin}/login?error=oauth_provider_error`
        );
      }

      const cookieStore = await cookies();

      const supabase = createServerClient<Database>(
        env.NEXT_PUBLIC_SUPABASE_URL,
        env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        {
          cookies: {
            getAll() {
              return cookieStore.getAll();
            },
            setAll(cookiesToSet) {
              try {
                cookiesToSet.forEach(({ name, value, options }) => {
                  cookieStore.set(name, value, options);
                });
              } catch {
                // Ignore errors from setting cookies in middleware context
              }
            },
          },
        }
      );

      // Exchange the authorization code for a session
      const { data: sessionData, error: sessionError } =
        await supabase.auth.exchangeCodeForSession(code);

      if (sessionError || !sessionData.user) {
        logger.error("Failed to exchange code for session", {
          error: sessionError?.message,
        });
        span.setStatus({ code: 2, message: "Code exchange failed" });
        Sentry.captureException(sessionError ?? new Error("No user after code exchange"), {
          tags: { flow: "oauth_callback" },
        });
        return NextResponse.redirect(
          `${origin}/login?error=oauth_provider_error`
        );
      }

      const user = sessionData.user;
      const provider = user.app_metadata?.provider ?? "unknown";
      span.setAttribute("auth.provider", provider);
      span.setAttribute("auth.userId", user.id);

      logger.info("OAuth user authenticated", {
        userId: user.id,
        provider,
      });

      // Validate email before attempting profile upsert
      if (!user.email) {
        logger.error("OAuth user has no email address", {
          userId: user.id,
          provider,
        });
        span.setStatus({ code: 2, message: "OAuth user has no email" });
        return NextResponse.redirect(
          `${origin}/login?error=oauth_no_email`
        );
      }

      const emailValidation = oauthEmailSchema.safeParse(user.email);
      if (!emailValidation.success) {
        logger.error("OAuth user email failed validation", {
          userId: user.id,
          provider,
          reason: emailValidation.error.issues[0]?.message,
        });
        Sentry.captureException(
          new Error("OAuth email validation failed"),
          {
            tags: { flow: "oauth_callback", step: "email_validation" },
            extra: {
              userId: user.id,
              provider,
              validationError: emailValidation.error.issues[0]?.message,
            },
          }
        );
        span.setStatus({ code: 2, message: "OAuth user has invalid email" });
        return NextResponse.redirect(
          `${origin}/login?error=oauth_invalid_email`
        );
      }

      // Extract and validate name from OAuth metadata (Google provides full_name)
      const rawName =
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        user.email?.split("@")[0] ||
        "";

      const nameParseResult = oauthNameSchema.safeParse(rawName);
      const fullName = nameParseResult.success
        ? nameParseResult.data
        : DEFAULT_NAME;

      if (!nameParseResult.success) {
        logger.warn("OAuth user name failed validation, using default", {
          userId: user.id,
          provider,
          reason: nameParseResult.error.issues[0]?.message,
        });
      }

      const isEmailVerifiedByProvider = isEmailVerifiedByOAuthProvider(user);

      // Atomic upsert with ignoreDuplicates: true (ON CONFLICT DO NOTHING).
      // If no profile exists, this inserts one. If it already exists, this is a
      // no-op. Using ignoreDuplicates avoids triggering the RLS UPDATE policy
      // which blocks modifications to billing fields.
      const { error: upsertError } = await supabase
        .from("profile")
        .upsert(
          {
            id: user.id,
            email: user.email,
            name: fullName,
            verified: isEmailVerifiedByProvider,
            handicapIndex: 54, // Explicit default to match email signup path
          },
          { onConflict: "id", ignoreDuplicates: true }
        );

      if (upsertError) {
        logger.error("Failed to upsert profile for OAuth user", {
          error: upsertError.message,
          code: upsertError.code,
          userId: user.id,
        });
        span.setStatus({ code: 2, message: "Profile upsert failed" });
        Sentry.captureException(new Error(upsertError.message), {
          tags: { flow: "oauth_callback", step: "profile_upsert" },
          extra: { code: upsertError.code, userId: user.id },
        });
        return NextResponse.redirect(
          `${origin}/login?error=oauth_account_creation_failed`
        );
      }

      // Query the profile to get current state (planSelected, verified).
      // This always runs after the upsert so we see the latest data.
      const { data: profile, error: profileQueryError } = await supabase
        .from("profile")
        .select("id, planSelected: plan_selected, verified")
        .eq("id", user.id)
        .maybeSingle();

      if (profileQueryError || !profile) {
        logger.error("Failed to query profile after upsert", {
          error: profileQueryError?.message,
          userId: user.id,
        });
        span.setStatus({ code: 2, message: "Profile query failed after upsert" });
        Sentry.captureException(
          profileQueryError ?? new Error("Profile not found after upsert"),
          {
            tags: { flow: "oauth_callback", step: "profile_query" },
            extra: { userId: user.id },
          }
        );
        return NextResponse.redirect(
          `${origin}/login?error=oauth_account_creation_failed`
        );
      }

      // Update verified status for users who signed up with email first then log
      // in with Google — but only if the OAuth provider actually verified the email.
      if (!profile.verified && isEmailVerifiedByProvider) {
        await Sentry.startSpan(
          {
            op: "db.update",
            name: "Update OAuth User Verified Status",
          },
          async (updateSpan) => {
            updateSpan.setAttribute("auth.userId", user.id);

            // RLS UPDATE policy ("Users can update their own profile") allows
            // updating where auth.uid() = id. The authenticated client from
            // exchangeCodeForSession satisfies this.
            const { error: verifyError } = await supabase
              .from("profile")
              .update({ verified: true })
              .eq("id", user.id);

            if (verifyError) {
              logger.warn("Failed to update verified status for OAuth user", {
                userId: user.id,
                error: verifyError.message,
              });
              updateSpan.setStatus({ code: 2, message: "Verify update failed" });
            } else {
              logger.info("Updated verified status for OAuth user", {
                userId: user.id,
                emailVerifiedByProvider: isEmailVerifiedByProvider,
              });
              updateSpan.setStatus({ code: 1 });
            }
          }
        );
      } else if (!profile.verified) {
        logger.info("OAuth user email not verified by provider, skipping auto-verify", {
          userId: user.id,
          provider,
        });
      }

      // Determine redirect based on plan status
      // Note: We check planSelected from the profile query, not JWT claims
      // This is because JWT claims may not be updated yet for OAuth flow
      if (!profile.planSelected) {
        logger.info("OAuth user has no plan, redirecting to onboarding", {
          userId: user.id,
        });
        span.setAttribute("oauth.result", "existing_user_no_plan");
        span.setStatus({ code: 1 });
        return NextResponse.redirect(`${origin}/onboarding`);
      }

      // User has a plan - redirect to home
      logger.info("OAuth user authenticated successfully", {
        userId: user.id,
        plan: profile.planSelected,
      });

      span.setAttribute("oauth.result", "existing_user");
      span.setAttribute("oauth.plan", profile.planSelected);
      span.setStatus({ code: 1 });

      return NextResponse.redirect(`${origin}/`);
    }
  );
}
