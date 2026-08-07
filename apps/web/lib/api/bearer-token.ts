/**
 * Bearer-token primitives shared by the two surfaces that accept one:
 * the first-party tRPC context (`server/api/trpc.ts`) and `/api/v1`
 * (`app/api/v1/_lib/principal.ts`).
 *
 * These functions were extracted from `server/api/trpc.ts` (PR #167) so `/v1`
 * reuses the shipped mechanism instead of growing a parallel one — a second
 * implementation of "is this an OAuth-client token?" is exactly how the two
 * surfaces would drift apart on a security-relevant question.
 *
 * The extraction is behaviour-preserving: each body is unchanged apart from
 * the added `export` keyword, re-wrapped signatures, and doc-comment rewraps.
 * The executable token streams are identical to `origin/main`'s.
 *
 * The validation path is deliberately NETWORK-based (`auth.getUser(token)`).
 * Local JWKS / `getClaims()` validation is PROHIBITED for external tokens
 * because it silently misses revocation (contract §6, spike criterion iii:
 * `revokeGrant` takes effect in ~47 ms on the network path).
 */

import {
  createClient,
  type SupabaseClient,
  type User,
} from "@supabase/supabase-js";

import { env } from "@/env";
import { logger } from "@/lib/logging";
import type { Database } from "@/types/supabase";

/**
 * Extract a bearer access token from an `Authorization` header.
 *
 * Accepts the canonical `Bearer <token>` format (case-insensitive scheme).
 * Returns null for missing headers, malformed values, empty tokens, or
 * non-Bearer schemes so the caller can safely fall through to the
 * unauthenticated branch.
 */
export function extractBearerToken(headers: Headers): string | null {
  const authHeader = headers.get("authorization");
  if (!authHeader) {
    return null;
  }

  // Accept exactly one space between scheme and token (RFC 6750 §2.1).
  const firstSpace = authHeader.indexOf(" ");
  if (firstSpace === -1) {
    return null;
  }

  const scheme = authHeader.slice(0, firstSpace);
  const token = authHeader.slice(firstSpace + 1).trim();

  if (scheme.toLowerCase() !== "bearer" || token.length === 0) {
    return null;
  }

  return token;
}

/**
 * Best-effort local decode of a JWT payload. Returns null when the token is
 * not a three-segment JWS or the payload isn't valid base64url JSON.
 *
 * This is NOT signature verification — callers must still validate via
 * Supabase. It exists solely to inspect claims BEFORE deciding whether the
 * token belongs on this surface at all.
 */
export function decodeJwtPayload(
  token: string
): Record<string, unknown> | null {
  const segments = token.split(".");
  if (segments.length !== 3) {
    return null;
  }
  try {
    const json = Buffer.from(segments[1], "base64url").toString("utf-8");
    const payload: unknown = JSON.parse(json);
    if (
      typeof payload !== "object" ||
      payload === null ||
      Array.isArray(payload)
    ) {
      return null;
    }
    return payload as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Fail-closed placement (api-platform DECISIONS §3): external OAuth-client
 * tokens — Supabase OAuth 2.1 server tokens carrying a `client_id` claim —
 * are accepted ONLY at the `/api/v1` mount. tRPC is a first-party surface, so
 * any `client_id`-bearing token is rejected there and new procedures stay
 * external-inaccessible by default.
 *
 * First-party web/native session tokens never carry `client_id` (the
 * custom_access_token_hook preserves it only when GoTrue stamped it for an
 * OAuth client — see 20260728090000_oauth_client_id_claims.sql), so this
 * check is a no-op for them. Tokens that don't decode locally fall through
 * to `auth.getUser`, which rejects anything malformed anyway.
 */
export function isExternalOAuthClientToken(token: string): boolean {
  const payload = decodeJwtPayload(token);
  return payload !== null && payload.client_id != null;
}

/**
 * Validate a Supabase access token via `auth.getUser(token)`.
 *
 * Uses the official Supabase validation path — the token is sent to Supabase
 * Auth, which verifies the signature, expiry, and revocation status. We
 * deliberately do NOT decode the JWT ourselves here; the server-side source
 * of truth is Supabase.
 *
 * Returns null for any failure (invalid/expired/revoked token, network error,
 * etc.) so callers can degrade to an unauthenticated context.
 */
export async function getUserFromBearerToken(
  token: string
): Promise<User | null> {
  try {
    const supabase = createClient(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        auth: {
          // Stateless validation — no cookie or localStorage involvement.
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      },
    );

    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data?.user) {
      // Expected for expired / invalid tokens. Log at debug to avoid noise.
      logger.debug("Bearer token rejected by Supabase", {
        error: error?.message,
      });
      return null;
    }

    return data.user;
  } catch (error) {
    logger.warn("Bearer token validation threw", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Build a request-scoped Supabase client that forwards the bearer token on
 * every PostgREST request. This lets downstream queries run under the bearer
 * user's RLS identity — `auth.uid()` inside policies resolves to the `sub`
 * claim of this token exactly as it would for a cookie-authenticated web
 * request.
 *
 * We create a fresh client (instead of mutating the cookie-bound SSR client)
 * because SSR's `setSession` expects a matching refresh token and would throw
 * on a server-only access token.
 */
export function createBearerTokenSupabaseClient(
  accessToken: string
): SupabaseClient<Database> {
  return createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    },
  );
}
