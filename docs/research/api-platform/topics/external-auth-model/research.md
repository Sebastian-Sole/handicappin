# external-auth-model — How does another app obtain credentials for a handicappin user?

**Researched:** 2026-07-20 · **Status:** complete · **Recommendation:** Option B (Supabase OAuth 2.1 server) with an app-layer endpoint allowlist keyed on the `client_id` claim.

## Decision question

How should the fitness app (v1, same developer) obtain a token that satisfies the existing Bearer path in `apps/web/server/api/trpc.ts` with correct RLS scoping — and which issuance model ships v1 fastest without dead-ending the third-party ambition?

---

## 1. What the codebase already provides (verified)

`apps/web/server/api/trpc.ts`:

- `extractBearerToken()` parses `Authorization: Bearer <token>` (RFC 6750).
- `getUserFromBearerToken()` validates via `supabase.auth.getUser(token)` — signature, expiry, **and revocation** are checked server-side by Supabase Auth (not local JWT decode).
- `createBearerTokenSupabaseClient()` builds a fresh anon-key client that forwards the token on every PostgREST request, so `ctx.supabase` queries run under the bearer user's RLS identity (`auth.uid()` = token `sub`). Cookie auth wins when both are present.

Implication: **any token that Supabase Auth recognizes as a valid user session token rides this path with zero code changes.** There is no API-key/PAT infrastructure anywhere in the repo (`app/api/` contains only ai, auth, billing, cron, legal, notifications, stripe, trpc, webhooks). `SUPABASE_SERVICE_ROLE_KEY` exists in `env.ts` but conventions restrict it to clearly-scoped server utilities.

The Bearer path grants the user's **full RLS surface** — every table a first-party session can touch, including profile and billing-adjacent rows. Nothing distinguishes *which app* presented the token.

---

## 2. Supabase OAuth 2.1 server — maturity as of July 2026

Sources: [OAuth 2.1 Server docs](https://supabase.com/docs/guides/auth/oauth-server), [Getting Started](https://supabase.com/docs/guides/auth/oauth-server/getting-started), [OAuth Flows](https://supabase.com/docs/guides/auth/oauth-server/oauth-flows), [GitHub discussion #38022](https://github.com/orgs/supabase/discussions/38022) (fetched 2026-07-20).

**Status: public beta** since 2025-11-26 ("currently in beta and free to use during the beta period on all Supabase plans"). Initially targeted GA Q4 2025; no updated GA date published. Still receiving spec-compliance fixes (e.g. 2026-05-26: `/oauth/token` now returns 200 instead of 201).

What's shipped:

- Authorization-code + PKCE (OAuth 2.1), OIDC ID tokens (`openid` scope requires asymmetric JWT signing), JWKS endpoint.
- Client registration via dashboard (**Authentication → OAuth Apps**) or admin API; dynamic client registration (built for MCP clients).
- **Consent screen is yours to build**: a page in the web app calls `supabase.auth.oauth.getAuthorizationDetails(authorization_id)` then `approveAuthorization()` / `denyAuthorization()`. Next.js examples provided.
- Refresh tokens with rotation; access tokens default 1h.
- User-side revocation: `supabase.auth.oauth.revokeGrant(clientId)` — "all active sessions and refresh tokens for that client are immediately invalidated."
- **Access tokens are standard Supabase JWTs** carrying `user_id`/`sub`, `role`, and `client_id` claims. Docs: "Your existing Row Level Security policies automatically apply to OAuth tokens."

The critical caveat, verbatim from the flows doc:

> "All OAuth access tokens have full access to user data (same as regular session tokens), with the addition of the `client_id` claim. Use Row Level Security policies with the `client_id` claim to control which data each OAuth client can access."

I.e. **granular scope-based token restriction is NOT shipped** — standard scopes (`openid email profile phone`) only affect the UserInfo response. Discussion #38022 confirms: scope management / scope-driven token generation is "Phase 2", not delivered as of the Feb 2026 team comments. The Custom Access Token Hook can inject per-`client_id` claims today, and `client_id` is readable both in RLS (`auth.jwt()->>'client_id'`) and in application code.

Other beta rough edges reported in #38022: `amr` claim format incompatible with AWS STS expectations; `/.well-known/oauth-authorization-server` doesn't flow through custom domains (Jan 2026); confidential-client `token_endpoint_auth_method` confusion; custom URI schemes for mobile deeplinks fixed in auth v2.186.0. The client-side flow is **not wrapped by supabase-js** — the consuming app implements the auth-code flow itself (any standard OAuth client library works, since the endpoints are spec-compliant).

**Fit with the existing Bearer path:** because OAuth access tokens are ordinary Supabase session JWTs (revocation invalidates *sessions*, and the docs state RLS applies identically), `getUserFromBearerToken()`'s `auth.getUser(token)` should accept them unchanged and `createBearerTokenSupabaseClient()` gives correct `auth.uid()` scoping. This is the single load-bearing assumption to verify in a spike; the fallback if `getUser` were ever to reject them is local JWKS validation (`.well-known/jwks.json`), a small, documented change.

---

## 3. Prior art — what activity-write APIs treat as table stakes

| Platform | Model | Scoping | Tokens | Gatekeeping |
|---|---|---|---|---|
| **Strava** | OAuth 2.0 auth-code | Granular scopes; manual activity upload requires `activity:write` | 6-hour access tokens + refresh tokens | Apps start in "single-player mode"; review required past 10 connected athletes; 200 req/15min + 2,000/day default per app |
| **Whoop** | OAuth 2.0 auth-code | `read:workout`, `read:profile`, etc.; `offline` scope gates refresh-token issuance | ~1h access + refresh | Apply for API access via developer portal |
| **Garmin (Health/Activity API)** | OAuth (Health API still OAuth 1.0a legacy; newer APIs OAuth 2.0) | Per-API partitioning rather than fine scopes | — | Closed partner program; **program suspended to new developers as of 2025/26** |
| **Terra** (aggregator) | Developer `dev-id` + API key server-side; hosted widget performs user OAuth against each provider | Provider-level | — | Self-serve dashboard |

Sources: [Strava auth docs](https://developers.strava.com/docs/authentication/), [Strava getting started](https://developers.strava.com/docs/getting-started/), [Whoop OAuth docs](https://developer.whoop.com/docs/developing/oauth/), [Garmin developer program / FAQ](https://developer.garmin.com/gc-developer-program/health-api/), [Terra docs](https://docs.tryterra.co/health-and-fitness-api/user-authentication/authentication-flow) (all checked 2026-07-20).

**Table stakes for genuine third parties:** OAuth 2.0/2.1 authorization-code with user consent, granular scopes (write-only-what-you-need), short-lived access + refresh tokens, user-facing revocation, per-app rate limits, and an app-review/approval gate. Nobody hands third parties a full-account credential. PATs/API keys appear only as *developer* credentials (Terra's server-side key identifies the developer, not the end user).

**Calibration for v1:** a same-developer integration is analogous to Strava's "single-player mode" — full-surface tokens between your own apps are the same trust level as the existing native app. Scoping becomes non-negotiable exactly when the first external developer shows up.

---

## 4. Options

### Option A — Shared Supabase project (fitness app authenticates against handicappin's Supabase directly)

The fitness app embeds handicappin's project URL + anon key and signs users in with supabase-js; the resulting session access token satisfies the Bearer path immediately.

**Pros**
- Zero backend auth work; ships today. Identical to how the native app works.
- Refresh handled by supabase-js automatically.
- Correct RLS scoping for free.

**Cons**
- Couples product identity: a fitness-app account *is* a handicappin account (same `auth.users` row, same password/OAuth identities). Fine only if "one account across my apps" is an intentional product decision.
- No per-app identity at all: no `client_id`, no way to distinguish/rate-limit/revoke the fitness app vs web vs native, no consent moment, no per-app attribution for topic 6 (any header is spoofable).
- Full RLS surface with no lever to narrow it (can't write `client_id`-conditional policies — the claim doesn't exist).
- Dead-ends the third-party ambition completely; migrating later forces every fitness-app user through a re-auth.

### Option B — Supabase OAuth 2.1 server (beta)

Register the fitness app as an OAuth client in handicappin's Supabase project; build the consent page in `apps/web`; fitness app runs auth-code+PKCE and stores rotating refresh tokens; access tokens hit the existing Bearer path unchanged.

**Pros**
- Tokens are standard Supabase JWTs → existing `getUser()` validation + RLS scoping work with **zero changes to trpc.ts**.
- Per-app identity via `client_id` claim → enables (i) an app-layer endpoint allowlist (OAuth-presented tokens may call only `round.submitScorecard` + course lookup), (ii) `client_id`-aware RLS policies (e.g. deny UPDATE on profile/billing tables when `auth.jwt()->>'client_id' IS NOT NULL`), (iii) per-app rate-limit keys and round attribution.
- Consent + refresh rotation + `revokeGrant` out of the box — the exact third-party table-stakes shape (Strava/Whoop-equivalent), so the platform path is *adding scopes when Supabase ships Phase 2*, not a rebuild.
- Free during beta, all plans; estimated 2–4 days of work (client registration, consent page, fitness-app flow, allowlist middleware).

**Cons**
- **Beta**: no GA date, post-GA pricing unknown, spec-adjacent bugs still being fixed; custom-domain metadata endpoint issue open (matters if `api.handicappin.com` topology is chosen in topic 3).
- No scope-restricted tokens yet — interim scoping is your own allowlist/RLS work keyed on `client_id`.
- Client-side flow not in supabase-js; fitness app implements standard OAuth (minor — libraries abound).
- Consent screen is bespoke UI work in `apps/web`.

### Option C — Custom Drizzle-backed PAT/API keys (optionally Unkey; better-auth rejected)

A `api_keys` table (hashed secrets) or [Unkey](https://www.unkey.com/) (active in 2026, AGPL source-available, external contributions paused, now pivoting toward a broader deploy platform) issues opaque keys; a route-handler layer validates them.

**Pros**
- Full control over scopes, expiry, metering from day one; no dependence on a beta.
- Right shape for *machine* credentials (a future server-to-server partner tier).

**Cons**
- Opaque keys are **not Supabase JWTs** → the existing Bearer path rejects them. You must either (i) run queries through the service-role client and hand-roll every authorization check (conventions forbid casual service-role use; one missed check = cross-user data leak on billing/profile tables), or (ii) mint Supabase-compatible JWTs yourself — unsupported and fragile now that shared JWT secrets are being phased out in favor of asymmetric signing keys, and `getUser()` validates against server-side session state.
- Wrong UX for a consumer integration: end users don't paste PATs; you'd rebuild an OAuth-ish grant flow anyway.
- better-auth would be a second, parallel auth system beside Supabase Auth — direct conflict with the existing stack; rejected outright.
- Most work of the three (weeks, not days), duplicating what Option B gives free.

---

## 5. Does a raw full-surface token need scoping even for v1?

**For v1 (same developer): no — with two cheap mitigations.** The fitness app is exactly as trusted as the native app, which already holds full-surface tokens. The real v1 risk is blast radius of a token leaked from the fitness app, and prior art says same-developer/single-player mode is an accepted phase. But because Option B tokens carry `client_id`, two near-free hardenings are worth doing at v1:

1. **Endpoint allowlist middleware**: if the validated token carries a `client_id` claim, permit only the public-API procedures (submit scorecard, course search, read own rounds/handicap). ~50 lines in the tRPC/route-handler layer; this is the interim "scope" until Supabase Phase 2 ships real scopes.
2. Optionally, **RLS backstop** on the most sensitive tables: policies that refuse writes when `auth.jwt()->>'client_id'` is present. First-party session tokens have no `client_id`, so web/native are unaffected.

**For any external third party: scoping is table stakes** (every comparable API has it). Do not onboard an external developer before either Supabase ships scope-restricted tokens or the allowlist mechanism is promoted to a real per-client scope registry.

---

## 6. Recommendation

**Option B — Supabase OAuth 2.1 server — with the `client_id` endpoint allowlist.** Confidence: high.

Reasoning: B costs only days more than A, reuses the Bearer plumbing byte-for-byte, and is the only option that is simultaneously v1-fast and third-party-shaped (consent, refresh rotation, revocation, per-app identity all included). A is faster but burns the platform ambition and even the same-developer needs (attribution, revocation, per-app limits) that topics 3 and 6 depend on. C fights the stack: it abandons free RLS scoping for hand-rolled service-role authorization, which is the highest-risk path in a codebase whose conventions are built around RLS. B is also low-regret: if the beta throws a blocker, A remains available behind the identical Bearer path (the fitness app swaps an OAuth flow for direct supabase-js sign-in), so the spike below caps downside at ~1 day.

**First step (1-day spike):** register a test OAuth client, run the auth-code flow against staging, and confirm (i) `auth.getUser(<oauth access token>)` in `getUserFromBearerToken()` returns the user, (ii) a `ctx.supabase` query is RLS-scoped to that user, (iii) `revokeGrant` kills the token, (iv) the `client_id` claim is present for the allowlist. Also confirm the Cloudflare/Vercel challenge bypass (topic 3) — no token model works until non-browser requests reach the origin.

## 7. Open questions

1. Spike verification: does `supabase.auth.getUser()` accept OAuth-server-issued access tokens exactly like session tokens (expected yes; fallback = JWKS validation, small change)?
2. Supabase OAuth server GA timing and post-beta pricing — unpublished as of 2026-07-20; monitor the [changelog](https://supabase.com/changelog) and [discussion #38022](https://github.com/orgs/supabase/discussions/38022).
3. Phase 2 scope management timing — determines when the interim allowlist can be replaced by real token scopes.
4. Product call for the same-developer case: should fitness-app users share the handicappin identity anyway (Option A's coupling) even under Option B, or keep separate identities with an explicit "Connect handicappin" consent moment? (B supports both; A forces the former.)
5. If topic 3 lands on `api.handicappin.com`, verify the custom-domain `/.well-known/oauth-authorization-server` metadata issue (reported Jan 2026) is fixed or irrelevant to the chosen flow.
6. Consent-screen parity: does the consent page need a native (`apps/native`) twin under the parity rules, or is it web-only (an `INTENTIONAL.webOnly` route)?

## Sources

- Codebase: `apps/web/server/api/trpc.ts` (Bearer extraction/validation/RLS client), `apps/web/env.ts` (service-role key), `apps/web/app/api/` (no key infra), `.claude/rules/coding-conventions.md`.
- [Supabase OAuth 2.1 Server docs](https://supabase.com/docs/guides/auth/oauth-server) · [Getting Started](https://supabase.com/docs/guides/auth/oauth-server/getting-started) · [OAuth Flows](https://supabase.com/docs/guides/auth/oauth-server/oauth-flows) · [Feature page](https://supabase.com/features/oauth2-1-server) — fetched 2026-07-20; beta since 2025-11-26.
- [Supabase discussion #38022 — OAuth 2.1 Server Capabilities](https://github.com/orgs/supabase/discussions/38022) — limitations, Phase 2 roadmap, comments through Feb 2026.
- [Strava authentication](https://developers.strava.com/docs/authentication/) · [Strava getting started](https://developers.strava.com/docs/getting-started/) — scopes, 6h tokens, single-player mode, rate limits.
- [Whoop OAuth 2.0](https://developer.whoop.com/docs/developing/oauth/) · [Whoop refresh tokens](https://developer.whoop.com/docs/tutorials/refresh-token-javascript/) — scopes incl. `offline`.
- [Garmin Health API / developer program](https://developer.garmin.com/gc-developer-program/health-api/) — closed partner program; new-developer signups suspended (2025/26).
- [Terra docs — authentication flow](https://docs.tryterra.co/health-and-fitness-api/user-authentication/authentication-flow) — dev-id + API key + widget model.
- [Unkey](https://www.unkey.com/) · [unkeyed/unkey on GitHub](https://github.com/unkeyed/unkey) — status July 2026: source-available AGPL, external contributions paused, platform pivot.
