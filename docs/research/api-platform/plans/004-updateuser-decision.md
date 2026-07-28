# 004 — `auth.updateUser` blast radius for OAuth-client tokens (DRAFT — needs OWNER sign-off)

**Status:** DRAFT · **Decider:** OWNER · **Prepared:** 2026-07-28 (build phase of subplan 004)
**Context:** spike criterion (vi) proved an OAuth-client access token works directly against
GoTrue: `GET /auth/v1/user` returns 200 and `updateUser({ user_metadata })` succeeds. The
email-change attempt 500'd only because the local `send_email` hook was misconfigured — a
local-env artifact, **not** a security control. The account-takeover surface must be treated
as reachable. Subplan 004 requires this blast radius decided **in writing**.

## What an OAuth-client token can reach on GoTrue today

| Operation | Reachable with an OAuth token? | Existing mitigation |
|---|---|---|
| `GET /auth/v1/user` (read identity) | Yes (200) | None — reads email, metadata. Roughly equivalent to the `profile`/`email` scopes the user consented to. |
| `updateUser({ user_metadata })` | **Yes (200, proven)** | None. |
| `updateUser({ email })` | Yes (request accepted) | `[auth.email] double_confirm_changes = true` — the change only completes after links are clicked at **both** the old and new address. A token alone cannot finish it, and the old-address email tips the user off. |
| `updateUser({ password })` | Yes (request accepted) | `[auth.email] secure_password_change = true` — GoTrue requires recent re-authentication (nonce) for password changes; a bare access token held server-side by a client app cannot satisfy it silently. **Must be confirmed enabled on the HOSTED project, not just local config.toml.** |
| `public.profile` row writes via PostgREST | **No — DENIED** | Implemented this subplan: RESTRICTIVE RLS policies (`20260728091000`) deny profile INSERT/UPDATE/DELETE and all access to billing/account tables for `client_id`-bearing tokens. |

## Why no code-level deny was shipped for the GoTrue surface

The task brief allowed implementing a deny "via the same RLS/hook mechanism" if feasible.
It is **not** feasible for `auth.updateUser`, and shipping a lookalike would be security
theater:

- **RLS cannot see it.** GoTrue mutates `auth.users` over its own privileged connection
  (`supabase_auth_admin`); RLS applies to PostgREST's `authenticated` role, not to GoTrue's
  internal writes. No `request.jwt.claims` GUC is set on that connection, so even a trigger
  on `auth.users` cannot tell an OAuth-client-initiated update from a first-party one.
- **The access-token hook cannot see it either.** The hook runs at token *issuance* and only
  shapes claims; GoTrue does not consult claims to authorize `updateUser` (scope enforcement
  is exactly the unshipped Phase-2 feature — discussion #38022).
- **No config lever exists** in GoTrue v2.184 to exempt OAuth-issued sessions from
  `/auth/v1/user` (verified against the spike's changelog/#38022 sweep: scope management
  unimplemented, no GA date).

## Options

**A. Accept as v1 risk, with mitigations pinned (RECOMMENDED).**
Accepted residual: an OAuth-client token can mutate `user_metadata` and read the GoTrue user
object. Email change is double-confirmed; password change requires re-authentication —
both must be verified ON on the hosted project when the owner enables the OAuth server.
Rationale: v1's only client is fitbull — first-party, confidential, tokens held server-side
in Convex, never on-device. `user_metadata` is not used for authorization anywhere in this
codebase (billing state lives in `public.profile`, which is now deny-policied; admin gating
is `ADMIN_EMAILS` against the verified session email). A leaked-token attacker gets metadata
graffiti and identity read — real, but bounded — and `revokeGrant` kills the session family
in ~47 ms (spike criterion iii).

**B. Accept, plus a detection tripwire.** Option A + a scheduled canary asserting
`double_confirm_changes` and `secure_password_change` remain enabled on the hosted project
(same class as the W0 cookie-less canary — a dashboard-side settings change silently
re-opens the surface). Cheap; recommended as a fast-follow if A is signed.

**C. Do not accept — block at the network edge.** Front GoTrue with a proxy that rejects
`PUT /auth/v1/user` when the bearer token carries `client_id`. Rejected for v1: Supabase
hosted GoTrue sits on `<ref>.supabase.co`, which we do not front; forcing all auth traffic
through our own domain is an ingress-scale project (W0 territory) for a surface v1's only
client (our own app) won't abuse.

**D. Do not ship OAuth until Phase-2 scopes.** Contradicts the spike GO and the locked
DECISIONS §3 direction; the external-third-party tripwire (§8) already covers the
genuinely dangerous population.

## Recommendation

**Option A now, B as a fast-follow.** Sign-off line items for the OWNER:

1. Accept the residual: OAuth-client tokens can read the GoTrue user object and write
   `user_metadata` until Supabase Phase-2 scopes ship. (Reversible: revisit the moment
   scopes or an auth hook for user updates land.)
2. When enabling the OAuth server on the hosted project, verify **Secure email change**
   (double confirm) and **Secure password change** (reauthentication) are both enabled —
   they are the load-bearing mitigations in the table above.
3. Optionally commission the Option-B settings canary alongside the W0 cookie-less canary.

## Related note for sign-off: consent-audience limitation (v1)

The consent page requires an existing handicappin session; a fitbull user with no
handicappin account is shown a sign-in link (signup reachable from there) and must restart
the connect from fitbull afterwards. Full sign-up-inside-authorization was NOT built.
Per subplan 004 ("or accept in writing that v1 serves only the overlap audience"), this
draft records that acceptance for OWNER sign-off alongside the updateUser decision.
