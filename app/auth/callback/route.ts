import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { Database } from "@/types/supabase";
import { logger } from "@/lib/logging";
import { env } from "@/env";
import { createAdminClient } from "@/utils/supabase/admin";

const MAX_NAME_LENGTH = 100;
const DEFAULT_NAME = "Golfer";

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
 * 2. Checks if a profile exists for the user
 * 3. Creates a profile if missing (OAuth users skip the signup form)
 * 4. Redirects to /onboarding if no plan, else to /
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const errorParam = requestUrl.searchParams.get("error");
  const errorDescription = requestUrl.searchParams.get("error_description");
  const origin = requestUrl.origin;

  // Handle OAuth errors (user cancelled, provider error, etc.)
  if (errorParam) {
    logger.warn("OAuth callback received error", {
      error: errorParam,
      description: errorDescription,
    });
    const errorMessage = errorDescription || errorParam;
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(errorMessage)}`
    );
  }

  // No code means something went wrong
  if (!code) {
    logger.error("OAuth callback missing authorization code");
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent("Authentication failed. Please try again.")}`
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
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent("Authentication failed. Please try again.")}`
    );
  }

  const user = sessionData.user;

  logger.info("OAuth user authenticated", {
    userId: user.id,
    provider: user.app_metadata?.provider,
  });

  // Check if profile exists for this user
  const { data: existingProfile, error: profileQueryError } = await supabase
    .from("profile")
    .select("id, planSelected: plan_selected, verified")
    .eq("id", user.id)
    .maybeSingle();

  if (profileQueryError) {
    logger.error("Failed to query profile", {
      error: profileQueryError.message,
      userId: user.id,
    });
    // Continue anyway - we'll try to create profile if needed
  }

  // If no profile exists, create one for the OAuth user
  if (!existingProfile) {
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
        provider: user.app_metadata?.provider,
        reason: nameParseResult.error.issues[0]?.message,
      });
    }

    // Determine email verification status from the OAuth provider.
    // Google includes `email_verified` in user_metadata, and Supabase sets
    // `email_confirmed_at` when the provider confirms the email. We check both
    // to be defensive: the email is only considered verified if at least one
    // source confirms it.
    const isEmailVerifiedByProvider =
      user.user_metadata?.email_verified === true ||
      user.email_confirmed_at != null;

    logger.info("Creating profile for OAuth user", {
      userId: user.id,
      provider: user.app_metadata?.provider,
      emailVerifiedByProvider: isEmailVerifiedByProvider,
    });

    if (!user.email) {
      logger.error("OAuth user has no email address", {
        userId: user.id,
        provider: user.app_metadata?.provider,
      });
      return NextResponse.redirect(
        `${origin}/login?error=${encodeURIComponent("No email associated with this account. Please try a different sign-in method.")}`
      );
    }

    // Use admin client (service role key) for profile creation to avoid
    // dependency on RLS policies, consistent with the email signup flow
    const supabaseAdmin = createAdminClient();

    // Re-check if profile was created by a concurrent request between
    // the initial query and now (race condition window)
    const { data: concurrentProfile } = await supabaseAdmin
      .from("profile")
      .select("id, plan_selected")
      .eq("id", user.id)
      .maybeSingle();

    if (concurrentProfile) {
      logger.info("Profile already created by concurrent OAuth request", {
        userId: user.id,
        provider: user.app_metadata?.provider,
      });
      // Profile exists now - redirect based on plan status
      if (!concurrentProfile.plan_selected) {
        return NextResponse.redirect(`${origin}/onboarding`);
      }
      return NextResponse.redirect(`${origin}/`);
    }

    const { error: upsertError } = await supabaseAdmin
      .from("profile")
      .upsert(
        {
          id: user.id,
          email: user.email,
          name: fullName,
          verified: isEmailVerifiedByProvider,
          handicapIndex: 54, // Explicit default to match email signup path
        },
        { onConflict: "id" }
      );

    if (upsertError) {
      // Handle PostgreSQL unique violation - profile was created by a concurrent request
      const POSTGRES_UNIQUE_VIOLATION = "23505";
      if (upsertError.code === POSTGRES_UNIQUE_VIOLATION) {
        logger.info(
          "Profile creation hit unique constraint - concurrent request already created it",
          {
            userId: user.id,
            provider: user.app_metadata?.provider,
          }
        );
        // Profile exists, this is safe to treat as success - redirect to onboarding
        return NextResponse.redirect(`${origin}/onboarding`);
      }

      logger.error("Failed to upsert profile for OAuth user", {
        error: upsertError.message,
        code: upsertError.code,
        userId: user.id,
      });
      return NextResponse.redirect(
        `${origin}/login?error=${encodeURIComponent("Failed to create account. Please try again.")}`
      );
    }

    logger.info("Profile created for OAuth user", {
      userId: user.id,
    });

    // New OAuth user - always redirect to onboarding
    return NextResponse.redirect(`${origin}/onboarding`);
  }

  // Update verified status for users who signed up with email first then log
  // in with Google — but only if the OAuth provider actually verified the email.
  const isEmailVerifiedByProvider =
    user.user_metadata?.email_verified === true ||
    user.email_confirmed_at != null;

  if (!existingProfile.verified && isEmailVerifiedByProvider) {
    const supabaseAdmin = createAdminClient();
    const { error: verifyError } = await supabaseAdmin
      .from("profile")
      .update({ verified: true })
      .eq("id", user.id);

    if (verifyError) {
      logger.warn("Failed to update verified status for OAuth user", {
        userId: user.id,
        error: verifyError.message,
      });
    } else {
      logger.info("Updated verified status for OAuth user", {
        userId: user.id,
        emailVerifiedByProvider: isEmailVerifiedByProvider,
      });
    }
  } else if (!existingProfile.verified) {
    logger.info("OAuth user email not verified by provider, skipping auto-verify", {
      userId: user.id,
      provider: user.app_metadata?.provider,
    });
  }

  // Determine redirect based on plan status
  // Note: We check planSelected from the profile query, not JWT claims
  // This is because JWT claims may not be updated yet for OAuth flow
  if (!existingProfile.planSelected) {
    logger.info("OAuth user has no plan, redirecting to onboarding", {
      userId: user.id,
    });
    return NextResponse.redirect(`${origin}/onboarding`);
  }

  // User has a plan - redirect to home
  logger.info("OAuth user authenticated successfully", {
    userId: user.id,
    plan: existingProfile.planSelected,
  });

  return NextResponse.redirect(`${origin}/`);
}
