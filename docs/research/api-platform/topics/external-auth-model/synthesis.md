# Synthesis — external-auth-model

**Date:** 2026-07-20 · **Panel:** white-hat, red-hat, black-hat, yellow-hat, green-hat, blue-hat, pre-mortem · **Verdict: CONSENSUS (conditional)**

## Decision

**Adopt Option B — the Supabase OAuth 2.1 authorization server (beta) — as the token-issuance model for the fitness app, gated behind a hardened, timeboxed spike, with the conditions below absorbed as binding parts of the decision.** Option A (direct sign-in against the shared Supabase project) is the designated fallback and rides the byte-identical Bearer path in `apps/web/server/api/trpc.ts`. Option C (custom PAT/API-key table, Unkey, better-auth) is **rejected unanimously**: opaque keys don't satisfy the existing Bearer path, forcing service-role queries plus hand-rolled authorization in an RLS-centric codebase — the highest-leak-risk path available, and the most work.

Stated confidence is downgraded from the research's "high" to **"high, conditional on a passed spike"** (blue hat): the load-bearing mechanism — `auth.getUser()` accepting OAuth-issued access tokens — is an inference from docs, not a verified fact.

## Why this is consensus

Four perspectives (white, yellow, green, blue) endorse B outright. The three mixed verdicts (red, black, pre-mortem) do not contest B's core logic — that OAuth access tokens are ordinary Supabase session JWTs reusing the existing Bearer+RLS plumbing with zero server changes, while adding per-app identity (`client_id`), consent, refresh rotation, and revocation that A can never provide. Their objections are condition-shaped (spike scope, mandatory-vs-optional RLS backstop, cost realism, exit criteria, sequencing) and are absorbed below rather than treated as vetoes. No perspective argued for C; no perspective argued A is *better* — only that A may be *sufficient* under one product-identity answer, and green hat defused the stakes of even that fork by showing A↔B share the same `auth.users` rows, making the upgrade path real in both directions. B supports both identity models; A forces one. Under genuine uncertainty about the product answer, B is the option that keeps both doors open.

## Binding conditions (absorbed from the critical reviews)

### 1. The spike is a hard gate, expanded and timeboxed (red, black, blue, pre-mortem, white)

Written pass/fail criteria, run against staging **and** a production-origin probe, timeboxed to ~2 days. If it degenerates into multi-day beta archaeology, ship Option A now and revisit B when a real third party materializes (red hat's tripwire).

Server-side checks:
- (i) `auth.getUser(<oauth access token>)` in `getUserFromBearerToken()` returns the user;
- (ii) `ctx.supabase` queries are RLS-scoped to that user;
- (iii) `revokeGrant` invalidates the token — measure revocation latency, and verify the JWKS-fallback path is understood to silently drop revocation (black hat);
- (iv) `client_id` claim is **present** on OAuth tokens **and absent** on first-party web/native session tokens — both hardenings depend on the second half, which is currently unverified (white hat);
- (v) OAuth-issued tokens link cleanly to an EXISTING `auth.users` account, proving the A↔B path is real in both directions (green hat).

Adversarial checks (black hat, pre-mortem):
- (vi) use the OAuth token directly against PostgREST (`<ref>.supabase.co/rest/v1` with the public anon key) and against GoTrue (`/auth/v1/user`, including `auth.updateUser` email/password change) — document exactly what surface it reaches outside tRPC.

Client-side checks (pre-mortem):
- (vii) full mobile round-trip from a real device build: auth-code+PKCE through deeplinks, secure token storage, and a forced concurrent refresh-rotation race (Supabase reuse-detection kills grant families silently).

Environment checks (all seven perspectives):
- (viii) a cookie-less non-browser request reaches the PRODUCTION origin past the Cloudflare/Vercel challenge — and this becomes a **permanent scheduled canary**, not a one-time checkbox, because a dashboard-side settings change can silently re-brick the integration.

### 2. RLS `client_id` deny-policies are MANDATORY, not optional (black hat, pre-mortem)

The ~50-line allowlist is routing hygiene, not a security boundary: the token works directly against PostgREST and GoTrue, bypassing tRPC entirely. Policies denying writes on billing/profile tables when `auth.jwt()->>'client_id' IS NOT NULL` are the only control that holds against a leaked token. Additionally: explicitly decide whether OAuth-token access to `auth.updateUser` (account-takeover surface via the fitness app) is acceptable v1 risk, and whether Supabase offers any lever to block it. Document in the implementation notes that the tRPC allowlist does not cover PostgREST or GoTrue.

### 3. Fail-closed scoping placement (green hat)

Accept external (`client_id`-bearing) tokens **only at the small public REST mount** (e.g. `/api/v1`) and reject them in tRPC context, instead of maintaining an allowlist inside tRPC. New procedures then become external-inaccessible by default. Same ~50 lines, better failure mode. Also: use the Custom Access Token Hook to stamp a forward-compatible scope claim (e.g. `rounds:write`) into OAuth tokens now, so enforcement points don't move when Supabase Phase 2 ships real scopes. Design this layer to be lived in — the red hat is right that no "interim" authz shim is ever removed on schedule.

### 4. Answer the product-identity question at the gate, before build (red, blue, pre-mortem)

Does the owner want **one shared account across his apps**, or **separate identities with an explicit "Connect handicappin" consent moment**? B supports both; the answer determines the consent UX and whether A would have sufficed. Corollary engineering prerequisite (pre-mortem): fitness-app users with **no** handicappin account hit a login wall inside the authorization webview — either design sign-up-inside-the-authorization-flow before build, or accept in writing that v1 serves only the overlap audience.

### 5. Beta exit criteria, written down now (black hat, pre-mortem, blue hat)

The "low-regret fallback to A" is only low-regret *before* code ships, and falling back **fails open** (client_id-keyed policies stop matching; consent/revocation/attribution vanish). Pre-commit to: a post-beta pricing ceiling, a breaking-change cost budget, and a GA-slip decision date, monitored via the Supabase changelog and discussion #38022. Sweep the changelog for Feb–Jul 2026 before building — Phase 2 scope management may have progressed beyond the Feb 2026 discussion comments (white hat).

### 6. Pre-build verifications (white, blue)

- Confirm the pinned `supabase-js` version ships the consent-page helpers (`auth.oauth.getAuthorizationDetails` / `approveAuthorization` / `denyAuthorization` / `revokeGrant`) before estimating the consent page.
- Settle the consent page's parity status now — `INTENTIONAL.webOnly` in `scripts/parity/routes.mjs` vs. a native twin — or it surfaces as a pre-commit `pnpm parity:routes` failure mid-build.
- Sequence with topic 3: verify the custom-domain `/.well-known/oauth-authorization-server` issue (reported Jan 2026) if `api.handicappin.com` is chosen, in the same spike.

### 7. Budget realism (red, black, pre-mortem)

Treat "2–4 days" as the optimistic bound and **1.5–2.5 weeks** as the planning budget: bespoke consent UI, mandatory RLS policies, fitness-app OAuth client + secure storage, refresh-rotation edge cases, and mobile deeplink handling were not priced in the original estimate. This does not change the B-vs-A ranking (yellow hat's asymmetry argument survives — the delta buys the entire third-party table-stakes bundle), but it changes expectations.

### 8. Hard tripwire: no external third party until real scopes exist (all)

Either Supabase Phase 2 scope-restricted tokens or a promoted per-client scope registry. This is a gate, not advice — the platform upside depends on never having handed an external developer a full-surface token (yellow hat).

## Dissent (strongest surviving counter-position)

**Red hat:** if the owner's answer to condition 4 is "one shared account across my apps," Option A is not a dead end — it *is* the design, B's consent flow is ceremony for your own product, and the realistic 1.5–2.5-week cost of B should instead go to the harder problems (Cloudflare bypass, extracting the 700-line `submitScorecard`). This position is honored by the spike timebox (bail to A on beta friction) and green hat's proof that A can graduate to B later without a re-auth catastrophe — but it remains the correct choice if the owner explicitly wants a single product identity and no third-party platform in the next ~12 months.

## What this unblocks

- Topic 3 (transport/gateway): `client_id` becomes the per-app rate-limit key; Cloudflare canary requirement feeds the same workstream.
- Topic 6 (attribution): per-app round attribution is one claim-read away.
- Platform path: swap allowlist for Phase 2 scopes + app review + docs; the fitness app becomes the reference integration and permanent canary (Strava single-player-mode playbook).
