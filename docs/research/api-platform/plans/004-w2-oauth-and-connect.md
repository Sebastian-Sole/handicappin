# 004 — W2: OAuth 2.1 spike → Connect-flow build

**Workstream:** W2 · **Status:** PENDING · **Billing-gated:** Partially (provisioning attachment point only)
**Depends on:** 001 (W0) — the cookie-less prod canary is spike criterion (viii).
**Blocks:** 005 (W4 auth section + `client_id` rate-limit principal), 006 (W5 Realtime rider only — not on the critical path).

---

## Goal

Run the timeboxed **~2-day** Supabase OAuth 2.1 (beta) spike with **written pass/fail criteria**; on pass, build the Connect flow (separate identities + an explicit "Connect handicappin" consent moment), the RLS `client_id` deny-policies, and the Custom Access Token Hook scope claim. The fallback is Option A (direct sign-in on the identical Bearer path) — but the owner's separate-identity requirement makes B strongly preferred; **if the spike fails, revisit rather than silently shipping A** (DECISIONS #3).

## Background

The first consumer is **fitbull**, the owner's separate Convex fitness app, which holds tokens **server-side in Convex** (not on-device). The owner's identity decision is locked: **separate identities + explicit linkage** ("Connect handicappin" moment), NOT a shared Supabase project. Option B (Supabase's OAuth 2.1 authorization server, currently beta) is the token-issuance model, because OAuth access tokens are ordinary Supabase session JWTs that reuse the existing Bearer+RLS plumbing with zero server changes, while adding per-app identity (`client_id`), consent, refresh rotation, and revocation that Option A can never provide. Option C (custom PAT/API-key table) was rejected unanimously — opaque keys don't satisfy the existing Bearer path and force service-role queries plus hand-rolled authorization in an RLS-centric codebase.

The load-bearing mechanism — `auth.getUser()` accepting OAuth-issued access tokens — is **inferred from docs, not verified**, so the spike is a hard gate. The current bearer path is `getUserFromBearerToken()` (`apps/web/server/api/trpc.ts:63`), and `createTRPCContext` (`trpc.ts:141-184`) today accepts **any** valid Supabase token with no `client_id` discrimination. The two hardenings that make external tokens safe both depend on a currently-unverified fact: that `client_id` is **present** on OAuth tokens **and absent** on first-party web/native session tokens. And because a leaked token works **directly against PostgREST and GoTrue** (bypassing tRPC entirely), the tRPC allowlist is routing hygiene, not a security boundary — RLS `client_id` deny-policies on billing/profile tables are the only control that holds.

The chief risk (pre-mortem #1) is that the 2-day spike degenerates into "beta archaeology" and stalls the critical path. Mitigation: a hard timebox with written pass/fail, and 001/002/003 proceed in parallel so a slip doesn't idle the team. Budget realism: treat "2–4 days" as the optimistic bound and **1.5–2.5 weeks** as the planning budget for the full build (bespoke consent UI, mandatory RLS policies, fitbull OAuth client + secure storage, refresh-rotation edge cases). This does not change the B-vs-A ranking; it changes expectations.

## Scope — Phase 2a: the spike (hard gate, ~2 days, staging + prod-origin probe)

**Written pass/fail criteria — copied verbatim from `topics/external-auth-model/synthesis.md` §1:**

> Written pass/fail criteria, run against staging **and** a production-origin probe, timeboxed to ~2 days. If it degenerates into multi-day beta archaeology, ship Option A now and revisit B when a real third party materializes (red hat's tripwire).
>
> Server-side checks:
> - (i) `auth.getUser(<oauth access token>)` in `getUserFromBearerToken()` returns the user;
> - (ii) `ctx.supabase` queries are RLS-scoped to that user;
> - (iii) `revokeGrant` invalidates the token — measure revocation latency, and verify the JWKS-fallback path is understood to silently drop revocation (black hat);
> - (iv) `client_id` claim is **present** on OAuth tokens **and absent** on first-party web/native session tokens — both hardenings depend on the second half, which is currently unverified (white hat);
> - (v) OAuth-issued tokens link cleanly to an EXISTING `auth.users` account, proving the A↔B path is real in both directions (green hat).
>
> Adversarial checks (black hat, pre-mortem):
> - (vi) use the OAuth token directly against PostgREST (`<ref>.supabase.co/rest/v1` with the public anon key) and against GoTrue (`/auth/v1/user`, including `auth.updateUser` email/password change) — document exactly what surface it reaches outside tRPC.
>
> Client-side checks (pre-mortem):
> - (vii) full mobile round-trip from a real device build: auth-code+PKCE through deeplinks, secure token storage, and a forced concurrent refresh-rotation race (Supabase reuse-detection kills grant families silently).
>
> Environment checks (all seven perspectives):
> - (viii) a cookie-less non-browser request reaches the PRODUCTION origin past the Cloudflare/Vercel challenge — and this becomes a **permanent scheduled canary**, not a one-time checkbox, because a dashboard-side settings change can silently re-brick the integration.

Also in the spike (verbatim, §6):

> - Confirm the pinned `supabase-js` version ships the consent-page helpers (`auth.oauth.getAuthorizationDetails` / `approveAuthorization` / `denyAuthorization` / `revokeGrant`) before estimating the consent page.
> - Settle the consent page's parity status now — `INTENTIONAL.webOnly` in `scripts/parity/routes.mjs` vs. a native twin — or it surfaces as a pre-commit `pnpm parity:routes` failure mid-build.
> - Sequence with topic 3: verify the custom-domain `/.well-known/oauth-authorization-server` issue (reported Jan 2026) if `api.handicappin.com` is chosen, in the same spike.

And sweep the Feb–Jul 2026 Supabase changelog + discussion #38022 for Phase-2 scope progress before building (white hat).

## Scope — Phase 2b: the build (on spike pass)

- **Fail-closed placement.** External (`client_id`-bearing) tokens accepted **only** at `/api/v1` and **rejected in tRPC context**. Today `createTRPCContext` (`trpc.ts:141-184`) accepts any valid Supabase token with no `client_id` discrimination — add the rejection in the tRPC context; the acceptance gate lives in the 005 route handlers. New procedures then become external-inaccessible by default.
- **RLS `client_id` deny-policies** on **billing/profile** tables (deny writes when `auth.jwt()->>'client_id' IS NOT NULL`) — **mandatory** (the token works directly against PostgREST/GoTrue; the tRPC allowlist does not cover them). Migration under `supabase/`. Explicitly decide whether OAuth-token access to `auth.updateUser` (account-takeover surface) is acceptable v1 risk and whether Supabase offers a lever to block it.
- **Custom Access Token Hook:** stamp a forward-compatible scope claim (e.g. `rounds:write`) from day one, so enforcement points don't move when Supabase Phase-2 real scopes ship.
- **Connect flow UI** (consent page). **Settle its parity status now** (`INTENTIONAL.webOnly` in `scripts/parity/routes.mjs` vs a native twin) or `pnpm parity:routes` blocks mid-build.
- **Sign-up-inside-authorization** for fitbull users with no handicappin account, **or** accept in writing that v1 serves only the overlap audience.

## Provisioning coupling (billing gate is CLOSED — cross-product deferred)

The **provisioning invariant is locked**: explicit, idempotent, consent-anchored provisioning (profile row if missing + `plan_selected='free'` + billing_version bump + PLAN_SELECTED event) — **never a silent null→free default inside `submitScorecard`**. The auth-independent fallback is **pinned now**: `POST /v1/profile/provision` (built in 005). Per the closed gate, **cross-product pricing is deferred** — v1 linkage simply requires a handicappin account (the free tier is the on-ramp); **no bundles/discounts/shared entitlements**. So the provisioning *attachment point* is decided here (link-time vs a default-`free`-at-profile-creation trigger), but there is no cross-product pricing to design. `billing_version` writes must follow the `profile-billing-write.ts` pattern (it participates in an RLS expression, `db/schema.ts:87`); machine-originated PLAN_SELECTED events must be segmented out of onboarding funnels.

## Binding conditions (verbatim)

From **external-auth-model §2, §3, §5, §8**:

> ### 2. RLS `client_id` deny-policies are MANDATORY, not optional
> The ~50-line allowlist is routing hygiene, not a security boundary: the token works directly against PostgREST and GoTrue, bypassing tRPC entirely. Policies denying writes on billing/profile tables when `auth.jwt()->>'client_id' IS NOT NULL` are the only control that holds against a leaked token. Additionally: explicitly decide whether OAuth-token access to `auth.updateUser` (account-takeover surface via the fitness app) is acceptable v1 risk, and whether Supabase offers any lever to block it. Document in the implementation notes that the tRPC allowlist does not cover PostgREST or GoTrue.

> ### 3. Fail-closed scoping placement
> Accept external (`client_id`-bearing) tokens **only at the small public REST mount** (e.g. `/api/v1`) and reject them in tRPC context, instead of maintaining an allowlist inside tRPC. New procedures then become external-inaccessible by default. Also: use the Custom Access Token Hook to stamp a forward-compatible scope claim (e.g. `rounds:write`) into OAuth tokens now, so enforcement points don't move when Supabase Phase 2 ships real scopes.

> ### 5. Beta exit criteria, written down now
> The "low-regret fallback to A" is only low-regret *before* code ships, and falling back **fails open** (client_id-keyed policies stop matching; consent/revocation/attribution vanish). Pre-commit to: a post-beta pricing ceiling, a breaking-change cost budget, and a GA-slip decision date, monitored via the Supabase changelog and discussion #38022.

> ### 8. Hard tripwire: no external third party until real scopes exist
> Either Supabase Phase 2 scope-restricted tokens or a promoted per-client scope registry. This is a gate, not advice — the platform upside depends on never having handed an external developer a full-surface token.

From **golf-api-landscape §B.8**:

> 8. **Resolve the identity-layer design before freezing auth** (Black): do the two apps share one Supabase project, and can fitness-app tokens be scoped below full user privilege? If not, document the accepted blast radius explicitly rather than inheriting it silently.

## Non-goals

- Shipping Option A silently on spike failure — **revisit** instead (DECISIONS #3).
- Any external (non-fitbull) third party — hard tripwire: none until real token scopes exist.
- Cross-product pricing / bundles / shared entitlements — **deferred** (closed gate §c). v1 linkage = a handicappin account.
- Building `/api/v1` route handlers (005) — this workstream provides the auth gate and `client_id` principal they consume.
- The Realtime accelerator — out of v1 (see 006).

## Definition of done

- Spike: a written pass/fail record committed under `topics/external-auth-model/` (or `docs/`), every criterion (i)–(viii) marked; beta exit criteria (pricing ceiling, breaking-change budget, GA-slip date) written down.
- On pass: external tokens accepted at `/api/v1`, rejected in tRPC; `client_id` deny-policies live on billing/profile; scope claim stamped; Connect flow reachable; sign-up-inside-authorization built or overlap-only accepted in writing.
- `pnpm parity:routes` green (consent page classified as `INTENTIONAL.webOnly` or given a native twin).

## Verification commands

```bash
pnpm test:integration   # adversarial PostgREST/GoTrue probes assert deny-policies bite; tRPC rejects client_id tokens
pnpm parity:routes      # consent page classified
pnpm lint
pnpm test:unit
```

Manual: full mobile PKCE round-trip from a real device build; the permanent canary (shared with 001/W0) asserts a cookie-less external token still reaches the origin.
