/**
 * YOU PROBABLY DON'T NEED TO EDIT THIS FILE, UNLESS:
 * 1. You want to modify request context (see Part 1).
 * 2. You want to create a new middleware or type of procedure (see Part 3).
 *
 * TL;DR - This is where all the tRPC server stuff is created and plugged in. The pieces you will
 * need to use are documented accordingly near the end.
 */
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";
import {
  createClient,
  type SupabaseClient,
  type User,
} from "@supabase/supabase-js";

import { env } from "@/env";
import { logger } from "@/lib/logging";
import type { Database } from "@/types/supabase";
import { createServerComponentClient } from "@/utils/supabase/server";

/**
 * Extract a bearer access token from an `Authorization` header.
 *
 * Accepts the canonical `Bearer <token>` format (case-insensitive scheme). Returns
 * null for missing headers, malformed values, empty tokens, or non-Bearer schemes
 * so the caller can safely fall through to the unauthenticated branch.
 */
function extractBearerToken(headers: Headers): string | null {
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
 * Validate a Supabase access token via `auth.getUser(token)`.
 *
 * Uses the official Supabase validation path — the token is sent to Supabase Auth,
 * which verifies the signature, expiry, and revocation status. We deliberately do
 * NOT decode the JWT ourselves here; the server-side source of truth is Supabase.
 *
 * Returns null for any failure (invalid/expired/revoked token, network error, etc.)
 * so callers can degrade to an unauthenticated context.
 */
async function getUserFromBearerToken(token: string): Promise<User | null> {
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
 * Build a request-scoped Supabase client that forwards the bearer token on every
 * PostgREST request. This lets downstream `ctx.supabase` queries run under the
 * bearer user's RLS identity — `auth.uid()` inside policies resolves to the
 * `sub` claim of this token exactly as it would for a cookie-authenticated web
 * request.
 *
 * We create a fresh client (instead of mutating the cookie-bound SSR client)
 * because SSR's `setSession` expects a matching refresh token and would throw
 * on a server-only access token.
 */
function createBearerTokenSupabaseClient(
  accessToken: string,
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

/**
 * 1. CONTEXT
 *
 * This section defines the "contexts" that are available in the backend API.
 *
 * These allow you to access things when processing a request, like the database, the session, etc.
 *
 * This helper generates the "internals" for a tRPC context. The API handler and RSC clients each
 * wrap this and provides the required context.
 *
 * @see https://trpc.io/docs/server/context
 */
export const createTRPCContext = async (opts: { headers: Headers }) => {
  const cookieSupabase = await createServerComponentClient();

  // 1. Attempt cookie-based auth first (web browser flow — unchanged).
  //    This also refreshes the Supabase session cookie when needed.
  const {
    data: { user: cookieUser },
  } = await cookieSupabase.auth.getUser();

  let user: User | null = cookieUser;
  let supabase: SupabaseClient<Database> = cookieSupabase;

  // 2. Fallback to Authorization: Bearer <token> (for native mobile clients
  //    or server-to-server tRPC callers that don't carry cookies).
  //
  //    Precedence: cookie session wins when BOTH are present. Rationale:
  //      - The cookie-bound client is already configured against the cookie
  //        session, so `ctx.supabase` and `ctx.user` stay consistent and
  //        RLS via `auth.uid()` resolves to the cookie user's id.
  //      - Accepting a bearer token for a different user alongside the
  //        cookie would create a silent mismatch between `ctx.user.id` and
  //        the DB's `auth.uid()`.
  //      - Web is the dominant path today; the only realistic way to hit
  //        "both" is a misconfigured client, so we pick the deterministic
  //        cookie branch and ignore the extra header.
  if (!user) {
    const bearerToken = extractBearerToken(opts.headers);
    if (bearerToken) {
      user = await getUserFromBearerToken(bearerToken);
      if (user) {
        // Swap in a bearer-scoped client so that downstream DB calls (via
        // `ctx.supabase`) execute with RLS scoped to the bearer user —
        // `auth.uid()` in policies resolves to `user.id`.
        supabase = createBearerTokenSupabaseClient(bearerToken);
      }
    }
  }

  return {
    supabase,
    user,
    ...opts,
  };
};

/**
 * 2. INITIALIZATION
 *
 * This is where the tRPC API is initialized, connecting the context and transformer. We also parse
 * ZodErrors so that you get typesafety on the frontend if your procedure fails due to validation
 * errors on the backend.
 */
const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
        // Include cause for non-Error objects (e.g., rate limit metadata)
        // Exclude Error instances to prevent leaking stack traces
        cause:
          error.cause instanceof ZodError || error.cause instanceof Error
            ? undefined
            : error.cause,
      },
    };
  },
});

/**
 * Create a server-side caller.
 *
 * @see https://trpc.io/docs/server/server-side-calls
 */
export const createCallerFactory = t.createCallerFactory;

/**
 * 3. ROUTER & PROCEDURE (THE IMPORTANT BIT)
 *
 * These are the pieces you use to build your tRPC API. You should import these a lot in the
 * "/src/server/api/routers" directory.
 */

/**
 * This is how you create new routers and sub-routers in your tRPC API.
 *
 * @see https://trpc.io/docs/router
 */
export const createTRPCRouter = t.router;

/**
 * Public (unauthenticated) procedure
 *
 * This is the base piece you use to build new queries and mutations on your tRPC API. It does not
 * guarantee that a user querying is authorized, but you can still access user session data if they
 * are logged in.
 */
export const publicProcedure = t.procedure;

export const authedProcedure = t.procedure.use(async function isAuthed(opts) {
  const { ctx } = opts;
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  return opts.next({
    ctx: {
      // ✅ user value is known to be non-null now
      user: ctx.user,
    },
  });
});

// Exported for tests only — these helpers have no consumers outside `createTRPCContext`.
export const _testables = {
  extractBearerToken,
  getUserFromBearerToken,
  createBearerTokenSupabaseClient,
};
