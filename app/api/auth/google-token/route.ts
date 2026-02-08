import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { googleTokenRateLimit, getIdentifier } from "@/lib/rate-limit";
import { logger } from "@/lib/logging";

const requestSchema = z.object({
  code: z.string().min(1),
});

/**
 * Exchanges a Google OAuth authorization code for an ID token.
 * Used by the client-side Google sign-in button (useGoogleLogin auth-code flow)
 * to obtain an id_token for Supabase's signInWithIdToken.
 */
export async function POST(request: NextRequest) {
  return Sentry.startSpan(
    { op: "http.server", name: "POST /api/auth/google-token" },
    async (span) => {
      try {
        logger.info("Google token exchange started");

        const identifier = getIdentifier(request);
        const { success, limit, remaining, reset } =
          await googleTokenRateLimit.limit(identifier);

        if (!success) {
          const retryAfterSeconds = Math.ceil((reset - Date.now()) / 1000);
          logger.warn("Google token exchange rate limited", {
            retryAfterSeconds,
          });
          span.setStatus({ code: 2, message: "Rate limited" });
          return NextResponse.json(
            { error: "Too many requests", retryAfter: retryAfterSeconds },
            {
              status: 429,
              headers: {
                "X-RateLimit-Limit": limit.toString(),
                "X-RateLimit-Remaining": "0",
                "X-RateLimit-Reset": new Date(reset).toISOString(),
                "Retry-After": retryAfterSeconds.toString(),
              },
            }
          );
        }

        const body = await request.json();
        const parsed = requestSchema.safeParse(body);

        if (!parsed.success) {
          logger.warn("Google token exchange invalid request", {
            errors: parsed.error.flatten().fieldErrors,
          });
          span.setStatus({ code: 2, message: "Invalid request" });
          return NextResponse.json(
            { error: "Invalid request" },
            { status: 400 }
          );
        }

        const { code } = parsed.data;

        const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
        const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

        if (!clientId || !clientSecret) {
          logger.error("Google OAuth not configured: missing env variables");
          span.setStatus({ code: 2, message: "OAuth not configured" });
          return NextResponse.json(
            { error: "Google OAuth not configured" },
            { status: 500 }
          );
        }

        const tokenResponse = await fetch(
          "https://oauth2.googleapis.com/token",
          {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              code,
              client_id: clientId,
              client_secret: clientSecret,
              redirect_uri: "postmessage",
              grant_type: "authorization_code",
            }),
          }
        );

        if (!tokenResponse.ok) {
          const tokenError = await tokenResponse.json().catch(() => null);
          const errorMessage = `Google token exchange failed with status ${tokenResponse.status}`;
          logger.error(errorMessage, {
            status: tokenResponse.status,
            error: tokenError?.error ?? "unknown",
          });
          Sentry.captureException(new Error(errorMessage), {
            tags: { provider: "google", step: "token_exchange" },
            extra: {
              status: tokenResponse.status,
              googleError: tokenError?.error,
              googleErrorDescription: tokenError?.error_description,
            },
          });
          span.setStatus({ code: 2, message: "Token exchange failed" });
          return NextResponse.json(
            { error: "Failed to exchange code" },
            { status: 502 }
          );
        }

        const tokens = await tokenResponse.json();

        if (!tokens.id_token) {
          const errorMessage = "No ID token in Google token response";
          logger.error(errorMessage);
          Sentry.captureException(new Error(errorMessage), {
            tags: { provider: "google", step: "token_exchange" },
          });
          span.setStatus({ code: 2, message: "No ID token" });
          return NextResponse.json(
            { error: "No ID token in response" },
            { status: 502 }
          );
        }

        logger.info("Google token exchange successful");
        span.setStatus({ code: 1 });
        return NextResponse.json({ id_token: tokens.id_token });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        logger.error("Google token exchange error", { error: errorMessage });
        Sentry.captureException(error, {
          tags: { provider: "google", step: "token_exchange" },
        });
        span.setStatus({ code: 2, message: "Internal error" });
        return NextResponse.json(
          { error: "Internal server error" },
          { status: 500 }
        );
      }
    }
  );
}
