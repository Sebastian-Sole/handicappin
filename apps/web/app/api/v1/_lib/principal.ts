/**
 * Bearer-token principal extraction for `/v1`.
 *
 * Contract: `005-phase0-contract.md` §6 (FROZEN). `/v1` serves TWO principal
 * classes with asymmetric RLS treatment — the same route, same code path,
 * same user can see different data depending on whether the token carries
 * `client_id`. Every handler must therefore be written for the OAuth path
 * first, and integration tests must cover both classes per route.
 *
 * ── The three token shapes, and why the third one matters ─────────────────
 *
 *   | Token shape                        | Result                          |
 *   |------------------------------------|---------------------------------|
 *   | no `client_id`                     | first-party principal, no scope |
 *   |                                    | check                           |
 *   | `client_id` AND `scope` present    | OAuth principal; an operation   |
 *   |                                    | outside scope → 403 forbidden   |
 *   | `client_id`, `scope` ABSENT        | 401 unauthorized + Sentry alert |
 *
 * A fourth shape exists that §6 does not enumerate — a token whose claims do
 * not decode at all (opaque, or a JWS with a non-object payload). It is
 * treated as **401 unauthorized**, because an unclassifiable token must not
 * fall into the first-party branch by default. See the inline note below.
 *
 * **Principal class keys on `client_id` PRESENCE, never on the absence of a
 * claim.** An earlier draft of the contract said "a token with no `scope`
 * claim IS a first-party token", which is only true while the
 * custom_access_token_hook stamps `scope` unconditionally. If that hook
 * regresses, is bypassed, or a token predates it, that inference hands a
 * `client_id`-bearing token full first-party capability — a fail-open in the
 * exact place this module establishes a capability boundary. Absence of a
 * claim is not evidence of provenance; `client_id` is.
 *
 * ── Validation is a NETWORK check, always ─────────────────────────────────
 * `validateBearerToken` → `supabase.auth.getUser(token)` (`@/lib/api/
 * bearer-token`). Local JWKS validation / `getClaims()` is PROHIBITED for
 * external tokens because it silently misses revocation — a spike finding
 * (criterion iii: `revokeGrant` takes effect in ~47 ms on the network path),
 * not a preference. Missing, invalid, expired or REVOKED → 401.
 *
 * Ordering note (this module's own choice, contract is silent): the network
 * validation runs BEFORE the class/scope classification. Claims are read off
 * a token Supabase has already verified, and the scope-less alert therefore
 * fires only for genuine tokens — an unauthenticated stranger cannot mint
 * Sentry noise by posting a hand-crafted `client_id` JWT.
 */

import { captureSentryError } from "@/lib/sentry-utils";
import { createProblem, type ProblemDocument } from "@/lib/api/problem";
import {
  decodeJwtPayload,
  extractBearerToken,
  getUserFromBearerToken,
} from "@/lib/api/bearer-token";

/** The scope the custom_access_token_hook stamps unconditionally today. */
export const V1_SCOPES = {
  roundsWrite: "rounds:write",
} as const;

export interface V1FirstPartyPrincipal {
  class: "first-party";
  /** Supabase `sub`. */
  userId: string;
  /** The raw access token — for building an RLS-scoped Supabase client. */
  token: string;
  clientId: null;
  /** First-party tokens carry no `scope` claim and get no scope check. */
  scopes: null;
}

export interface V1OAuthPrincipal {
  class: "oauth";
  userId: string;
  token: string;
  clientId: string;
  scopes: readonly string[];
}

export type V1Principal = V1FirstPartyPrincipal | V1OAuthPrincipal;

export type AuthenticateResult =
  | { ok: true; principal: V1Principal }
  | { ok: false; problem: ProblemDocument };

export interface AuthenticateOptions {
  /** Correlation id copied into the problem's `instance`. */
  instance?: string;
  /**
   * Token validator. Defaults to the NETWORK path
   * (`supabase.auth.getUser`). Overridable for unit tests ONLY — a handler
   * must never pass a local/offline validator (see the header).
   */
  validateToken?: (token: string) => Promise<{ id: string } | null>;
}

function unauthorized(instance?: string): AuthenticateResult {
  return {
    ok: false,
    problem: createProblem({ code: "unauthorized", instance }),
  };
}

/** Read a non-empty string claim, treating everything else as absent. */
function stringClaim(
  claims: Record<string, unknown> | null,
  name: string
): string | null {
  const value = claims?.[name];
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

/**
 * Authenticate a `/v1` request and classify its principal.
 *
 * Returns a problem (401) rather than throwing, so a handler's happy path
 * stays linear and the failure is always the frozen envelope.
 */
export async function authenticateV1Request(
  request: Request,
  options: AuthenticateOptions = {}
): Promise<AuthenticateResult> {
  const { instance } = options;
  const validateToken = options.validateToken ?? getUserFromBearerToken;

  const token = extractBearerToken(request.headers);
  if (!token) {
    return unauthorized(instance);
  }

  // Network validation FIRST: signature, expiry and revocation are all
  // Supabase's answer to give, never ours.
  const user = await validateToken(token);
  if (!user) {
    return unauthorized(instance);
  }

  // The token is now verified, so its claims are authentic. The local decode
  // is a read of already-validated material, not a validation step.
  const claims = decodeJwtPayload(token);

  if (claims === null) {
    // A token whose claims cannot be read cannot be CLASSIFIED, and an
    // unclassifiable token must never default to full capability.
    //
    // This is the same fail-open shape as the scope-less case below, one
    // level up: `stringClaim(null, "client_id")` is null, which would read as
    // "no client_id ⇒ first-party" — i.e. the ABSENCE OF READABLE CLAIMS
    // taken as evidence of first-party provenance. Reachable inputs today:
    // an opaque (non-JWS) token, or a JWS whose payload is not a JSON object
    // (`decodeJwtPayload` returns null for an array payload by design).
    //
    // Unreachable while Supabase issues 3-segment JWTs — which is precisely
    // why closing it is free, and why leaving it open would hand full
    // first-party capability to every OAuth token the day the token format
    // changes.
    return unauthorized(instance);
  }

  const clientId = stringClaim(claims, "client_id");

  if (clientId === null) {
    // No `client_id` ⇒ first-party. Full capability on its own user, exactly
    // as on tRPC. No scope check applies.
    return {
      ok: true,
      principal: {
        class: "first-party",
        userId: user.id,
        token,
        clientId: null,
        scopes: null,
      },
    };
  }

  const scope = stringClaim(claims, "scope");
  if (scope === null) {
    // THE FAIL-OPEN FIX. A `client_id` token without `scope` is rejected —
    // never silently promoted to first-party.
    captureSentryError(
      new Error("OAuth client token arrived without a scope claim — rejected"),
      {
        level: "error",
        eventType: "v1-auth-missing-scope",
        userId: user.id,
        tags: { surface: "api-v1", client_id: clientId },
        extra: {
          reason:
            "custom_access_token_hook stamps scope unconditionally; a token without it predates the hook, bypassed it, or the hook regressed",
        },
      }
    );
    return unauthorized(instance);
  }

  return {
    ok: true,
    principal: {
      class: "oauth",
      userId: user.id,
      token,
      clientId,
      scopes: scope.split(/\s+/).filter((entry) => entry.length > 0),
    },
  };
}

/**
 * Does this principal hold `scope`?
 *
 * A first-party principal always does — it is not scope-constrained (§6).
 */
export function hasScope(principal: V1Principal, scope: string): boolean {
  if (principal.class === "first-party") {
    return true;
  }
  return principal.scopes.includes(scope);
}

/**
 * `403 forbidden` when the operation is outside the token's scope, else null.
 * Returns a problem instead of throwing so scope checks read as guards.
 */
export function requireScope(
  principal: V1Principal,
  scope: string,
  context: { instance?: string } = {}
): ProblemDocument | null {
  if (hasScope(principal, scope)) {
    return null;
  }
  return createProblem({ code: "forbidden", instance: context.instance });
}
