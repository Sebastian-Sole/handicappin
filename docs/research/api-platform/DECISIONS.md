# API Platform — Locked Decisions (ADR)

Date: 2026-07-22
Status: LOCKED except §Open gates
Process: 8-topic research → 7-perspective review panels (6 thinking hats + pre-mortem) → per-topic + global synthesis (`SYNTHESIS.md`) → owner Q&A (2 rounds, 2026-07-20/22).
Full conditions per topic live in `topics/<id>/synthesis.md` — this file records the outcomes; the synthesis conditions are binding unless explicitly overridden here.

## Owner facts established (2026-07-20/22)

- The first consumer is **fitbull**, the owner's fitness app: **separate product** with its own auth, billing, and DB, running on **Convex** (has a real backend).
- Third-party platform ambition: **option kept open, not affirmed** — build fitness integration first; no public platform distribution this cycle.
- Identity model: **separate identities + explicit linkage** ("Connect handicappin" moment). NOT a shared Supabase project.
- Ingress incident fix: **approved to execute now**.

## Locked decisions

1. **No stack change.** Public API ships as Next.js route handlers under `apps/web/app/api/v1/`. Serverless-timeout premise falsified: handicap recalc is already async (`handicap_calculation_queue` + pg_cron Edge Function). Separate service deferred behind five monitored split triggers (see hosting synthesis); second Vercel project is the middle rung.
2. **Extract `submitScorecard` first** to `apps/web/server/services/scorecard/` as `submitScorecard(deps, input)` — framework-free, ESLint import-boundary enforced, characterization tests (golden round fixtures → expected index) before rewiring tRPC to it. Merge-blocking precondition for /v1 work.
3. **Auth = Supabase OAuth 2.1 authorization server (beta) — SPIKE PASSED 2026-07-28, GO confirmed** (full results: `plans/004-spike-results.md`; key conditions: custom_access_token_hook must preserve `client_id` — it currently strips it; OAuth refresh goes via `/auth/v1/oauth/token` with client auth, fitting fitbull's confidential Convex client; never request the `openid` scope; app hosts its own `/oauth/consent`). Originally gated on a timeboxed ~2-day spike with written pass/fail criteria (see external-auth synthesis for the full list: getUser() on OAuth tokens, RLS scoping, client_id presence/absence, PostgREST + GoTrue adversarial probes incl. auth.updateUser, PKCE round-trip, prod cookie-less canary). Fallback = Option A (direct sign-in on the same Bearer path) — but note the owner's separate-identity requirement makes B strongly preferred; if the spike fails, revisit rather than silently shipping A.
   - RLS `client_id` deny-policies on billing/profile tables: **mandatory** (tRPC allowlist is not a security boundary).
   - Fail-closed placement: external `client_id` tokens accepted ONLY at `/api/v1`; rejected in tRPC context. Scope claim stamped via Custom Access Token Hook from day one.
   - No external third party until real token scopes exist.
   - fitbull holds tokens **server-side in Convex**, not on-device.
4. **Ingress = grey-clouded (DNS-only) `api.handicappin.com`** on the same Vercel project; challenge replaced on API paths by Bearer auth + Upstash per-identity limits + one Vercel WAF rate-limit rule + spend alerts. Path-scoped bypass rules are NOT viable (Attack Mode overrides). `api.` host is fitbull's base URL from its first commit. Sequence: dashboard checks → external canary BEFORE firewall changes → remove/narrow challenge (rollback rule prepped) → Stripe/RevenueCat webhook-delivery audit for the challenge period. Confirmed live 2026-07-22: 429 challenge on `/` and `/api/trpc/*`, Cloudflare orange-cloud, `api.` host does not exist yet.
5. **Contract = hand-written REST /v1** with shared zod schemas, OpenAPI 3.1 generated from those schemas, CI regen-and-diff gate, RFC 9457 problem+json with closed append-only code set, URL-path versioning. trpc-to-openapi and published-tRPC-client rejected. Surface marked internal/unstable until a second consumer exists. Deprecation-policy/Sunset-header machinery deferred until a non-owned consumer exists.
6. **Scorecard writes:** synchronous 201 with provisional index + `handicapRevision:"pending"`; strict API-side validation, server-derived `hcpStrokes`/`approvalStatus`, machine-readable 422s; natural-key unique index on rounds (incl. `nineHoleSection`, pinned `teeTime` semantics) after a prod duplicate scan; course/tee search-resolve read endpoint in v1.
   - **Catalog miss (owner, 2026-07-22): course-submission endpoint ships in v1** (rate-limited, mirrors the web pending-course flow + moderation queue). Not catalog-only 422; not manual-round quarantine.
   - **Idempotency (owner-delegated, 2026-07-22): externalId-primary** — `UNIQUE(userId, externalId)`, replay-by-lookup; `Idempotency-Key` header addable later non-breaking. Brandur key-table and natural-key-only rejected for v1.
   - Web-hardening split (default taken): API-side enforcement of shared-zod invariants now; web cutover to server-derived hcpStrokes is a **separate gated decision** (needs historical-data audit + hcpStrokes parity check + PR #135 partial-state regression pass).
7. **Sync:** plain REST reads (polling + refetch-on-foreground/after-submit) as the contract; **plus** evaluate the first-party pg_net → Convex HTTP action webhook (shared secret, hardcoded, non-contractual) since fitbull has a backend — panel condition (1) satisfied "yes". Evaluate the ~10-line post-submit queue-kick (likely collapses recalc latency to ~1–2s) and measure real recalc latency before freezing poll cadences. Supabase Realtime: not in v1, non-contractual forever for external consumers. `updated_at` on `round` added now; delete strategy decided on paper.
8. **Strategy:** private first-party seam this cycle; vetted-partner is the phase-2 shape behind falsifiable triggers (dated ADR, ~2026-10 calendar review, end-Q1-2027 re-decide); NGF Leverandør certification is the real platform prize; write-only-by-default principle applies to third parties (not to fitbull's own reads); demand instrumentation (API-interest form + PostHog event) ships with v1.
9. **One migration bundles:** natural-key index + `externalId` + `submitted_via` + `updated_at` (unblocked now that idempotency is decided).

## Billing gate — CLOSED (owner, 2026-07-27)

Decided with the prod round distribution in hand (6 users with rounds: 1 free @ 2 rounds, 5 lifetime @ 1/1/1/3/9 — nobody near the cap):
- (a) **Over-limit behavior: accept-and-quarantine.** Over-limit API rounds are stored excluded from handicap/counts and unlock on upgrade. The in-transaction check decides active-vs-quarantined; the post-commit delete-on-race (round.ts:949-992) is deleted, not replaced with a reject.
- (b) **Free tier: lifetime-25 unchanged.** Revisit with real volume.
- (c) **Cross-product pricing: deferred.** v1 linkage simply requires a handicappin account (free tier is the on-ramp). No bundles/discounts/shared entitlements until demand data exists.
- The RFC 9457 billing error contract and provisioning flow are now unblocked and must reflect quarantine semantics (a quarantined round is a 201 with a distinguishable status, not an error).

## Ingress incident — RESOLVED (2026-07-22)

Mitigation identified as Bot Protection managed ruleset (Challenge), documented-broken behind Cloudflare orange-cloud. Flipped to Log by owner; cookie-less prod access confirmed restored same day (www tRPC 204, no x-vercel-mitigated). Plan tier = Pro; Attack Mode off. Stripe live audit: no revenue events lost; 4 customer.created undelivered (~nil impact), resend commands handed to owner. webhook_events ledger corroborates (gap 06-22→07-06); zero RevenueCat events ever. Remaining W0 items: merge canary PR #162, Vercel spend alerts, `api.handicappin.com` grey-cloud CNAME + Vercel domain, Upstash fail-closed fix, rollback rule doc. See INGRESS_RUNBOOK.md addendum.

## Open gates
- **Governance check (pre-launch):** USGA/NGF fact-pattern question answered before v1 ships (fitbull publicly surfaces the unofficial WHS-method index regardless of API privacy).
- **Web-hardening cutover** (see 6, separate gate).

## Superseded/reconciled wording

- Any topic text saying "scope the Cloudflare bypass rule" is superseded by decision 4 (grey-cloud host).
- "Write-only-by-default" (topic 8) reconciled as third-party-only; fitbull polls reads per decision 7.
- The two coherent-package fork (`SYNTHESIS.md` §2.2) resolved to: **REST /v1 + OAuth B** (owner chose separate identities + linkage).
