# API Platform — Locked Decisions (ADR)

Date: 2026-07-22
Status: LOCKED except §Open gates
Process: 8-topic research → 7-perspective review panels (6 thinking hats + pre-mortem) → per-topic + global synthesis (`SYNTHESIS.md`) → owner Q&A (2 rounds, 2026-07-20/22).
Full conditions per topic live in `topics/<id>/synthesis.md` — this file records the outcomes; the synthesis conditions are binding unless explicitly overridden here.

## Sign-off: updateUser residual (owner, 2026-07-29) — ACCEPTED + detect-and-revoke

Empirically tested on local stack (secure_password_change + double_confirm both ON). Residual: a leaked/compromised `client_id` token can change the account password with no reauth ONLY within **24h of the user's original consent** — window is **non-renewable** (refresh keeps the same session created_at; new session needs the user's browser), **email change is blocked** (double-confirm), the change is **self-signaling** (kills other sessions), and **recoverable** (email reset). Passwordless users more exposed inside the window. No PREVENTIVE lever exists — GoTrue mutates auth.users over its own privileged connection, invisible to RLS/triggers at updateUser time.

**Decision: accept-with-mitigations + build the detective control.** Load-bearing prod settings (verified ON by owner 2026-07-29): "secure password change" (reauth for sessions >24h) and "secure email change" (double-confirm). NOTE: the "double confirm email changes" label the plan referenced is surfaced as **secure email change** in the current dashboard — same mechanism, verified enabled.

**Fast-follow subplan (NEW, own PR — NOT a blocker for #167):** (1) audit-log auto-revoke — scheduled job watching `auth.audit_log_entries` for password/email-change events on users holding an active session `WHERE oauth_client_id IS NOT NULL` → `revokeGrant()` + alert (collapses the 24h window to minutes-to-detection); (2) toggle watchdog — daily check that secure-password-change + secure-email-change remain ON, alert if either flips off (the two settings are the whole defense; guard against silent drift). Both ride the existing cron.

Decision rationale recorded: no managed auth provider (Auth0/Clerk/WorkOS) or backend swap (Neon = Postgres-only, no auth; Convex = full data-layer rewrite, app-code authz is a downgrade from RLS) removes this — it is inherent to OAuth-delegated bearer access. Fix where it lives, don't migrate. [[api-platform-fitbull-integration]]

## Sign-off: overlap-audience-only v1 (owner, 2026-07-29) — ACCEPTED

v1 Connect flow serves only users who already have a handicappin account (consent page shows sign-in, not inline sign-up). fitbull users without a handicappin account must self-serve create one (sign-in card links to sign-up) then return; the pending authorization survives. Inline sign-up-inside-authorization deferred until fitbull is shown to drive handicappin signups. No sign-up-in-consent to build for v1.

## Sign-off: pre-implementation decision set (owner, 2026-08-05) — 9 DECISIONS LOCKED

Elicited in a structured grilling session before any `/v1` code was written. These close every owner sign-off item in `plans/005-phase0-contract.md` §OWNER SIGN-OFF REQUIRED and answer U1–U3 in `GOVERNANCE.md` §5. Implementation plan: `plans/010-v1-implementation.md`.

**D1 — `/v1` is market-blind.** Every authorized consumer always receives `handicapIndex`; the API never withholds or conditionalizes it by market. Rationale: `profile` has no `country`/`market`/`region` column (verified — the only `country` in the schema is on `course`, `db/schema.ts:147`), so handicappin *structurally cannot* identify a US-market user. GOVERNANCE LB-1 is a **display** obligation and is discharged at the consumer's display layer, not in transport. **Irreversibility: adding a market signal later is non-breaking; removing or conditionalizing `handicapIndex` later is a `/v2`.**

**D2 — The wire field stays `handicapIndex`.** Despite `Handicap Index®` being a claimed mark (`GOVERNANCE.md` §2.2). Rationale: the exposure unit is public display, not a JSON key; the API is private, first-party and OAuth-scoped; the frozen OpenAPI prose uses the term throughout. The trademark obligation (LB-2) binds fitbull's visible copy. **Revisit trigger:** if the #148 grilling decides to de-mark the product generally, this becomes a `/v2` question — flagged deliberately, accepted deliberately.

**D3 — The OAuth consent page gates on plan selection.** A signed-in account with `plan_selected IS NULL` is redirected to onboarding and the pending authorization resumes afterwards, rather than being issued a token that can only ever 403. Verified gap: `app/oauth/consent/page.tsx:86` gates only on `supabase.auth.getUser()` and does **not** check `plan_selected`; the equivalent redirect already exists on the sign-in path at `app/auth/callback/route.ts:335`, and the `?redirect=` resume machinery is already open-redirect-guarded. This closes the `plan_required` dead-end **at its source** rather than at the API. Chosen over (a) accepting the dead-end and (b) a second SECURITY DEFINER provisioning RPC — (b) would have added a privileged surface and let a connected app create billing state. **`POST /v1/profile/provision` therefore stays first-party-only exactly as frozen**, and `plan_required` remains in the registry as a fail-closed guard for a state that should no longer occur.

**D4 — Quarantined rounds: badge in lists, filter from statistics.** A round the API accepted with `201` must remain visible; hiding it reintroduces at the display layer the rejection the billing gate explicitly refused. But statistics derived from handicap quantities must exclude quarantined rounds. Verified gaps: `server/api/routers/round.ts:63-69` (`getAllByUserId`) and `:145-150` (`getBestRound`) have **no** `quarantined` filter, so `getBestRound` — which orders by `scoreDifferential ASC LIMIT 1` — can return as "best" a round excluded from the handicap that `scoreDifferential` exists to feed. The counting sites (`round.ts:98`, `scorecard.ts:84`, `submit-scorecard.ts:714/931`) already filter correctly. Consequence accepted: `GET /v1/rounds` returns quarantined rounds carrying `status: "quarantined"`, and the badge is a component change that binds web↔native parity.

**D5 — `teeTime` sanity window: `1990-01-01` to `now + 24h`, rejected as `422`, enforced at the `/v1` boundary only.** Closes contract sign-off item 3. Today `types/scorecard-input.ts:185` is `z.string().datetime()` with **no bounds at all**, so web and native accept any date; the window is a new `/v1` refinement layered on the shared schema and deliberately does **not** tighten the existing web/native path (that would change behavior for current users mid-flight, an unrelated risk riding on an API change). Lower bound sized generously because historical backfill is a headline v1 benefit and **widening later is non-breaking while tightening is a `/v2`**; upper bound is clock-skew tolerance, and matters because `teeTime` is a verified durable handicap-manipulation vector (rounds are ordered by it; the index derives from a 20-round sliding window).

**D6 — Rate budgets.** Closes contract sign-off items 1 and 2. Per `(client_id, user)` pair — **not** bare `client_id`, which would collapse every fitbull user into one bucket so a single heavy user throttles everyone; this ratifies §3's wording over the looser sentence in `005-w4-v1-contract-and-handlers.md`. Sliding window, fail-closed, following the existing `lib/rate-limit.ts` + `env.ts:71-88` pattern (env var with code default, therefore tunable without a deploy — the *mechanism* is frozen, the *numbers* are ops values):

| Route family | Budget |
|---|---|
| rounds-write | 60 / min |
| reads | 120 / min |
| course-submission | 10 / hour |
| provision | 5 / hour |

The reads budget is a **stated ceiling on 006's polling cadence** — record it in the 007 fitbull notes rather than letting fitbull discover it via 429s.

**D7 — No proactive disclosure of fitbull to the USGA or NGF.** Closes GOVERNANCE §7.3. Owner's reasoning: they are two separate applications and neither body needs to be told about the second one. Consistent with inference I2 (a first-party companion app does not change the Norwegian fact pattern *in kind*), on which reading there is no new fact to report. Supersedes the §8 draft question, which disclosed fitbull explicitly and must be rewritten. **Residual accepted:** if NGF certifies handicappin as Leverandør and later notices fitbull, it is discovered rather than disclosed; the answer at that point is I2. If either body asks directly, answer honestly — this decision is about not volunteering.

**D8 — fitbull ships to the US but never displays the index.** Answers U2 (yes, US distribution) and U3 (no index display). **Consequence: LB-1's display half closes by construction** — there is no index display to geo-gate, in any market. `GOVERNANCE.md` anticipated exactly this ("no display ⇒ most of §4 evaporates"). Still live: LB-1's second clause (fitbull must not *advertise handicap features* to US-market users while the GPA track is open — store listing and marketing copy) and LB-2 (zero WHS marks in fitbull UI/store/marketing). Both are fitbull-repo release-checklist items, not handicappin work.

**D9 — Day-one `/v1` surface is five endpoints; G2 ships as server events only.** The contract freezes the *shape* of seven endpoints; it does not require all seven in the first pass.

- **Build:** `POST /v1/rounds`, `GET /v1/courses`, `GET /v1/tees`, `GET /v1/rounds`, `GET /v1/health`.
- **Defer:** `GET /v1/profile` (nothing displays the index, so nothing needs to read it), `POST /v1/courses`, `POST /v1/profile/provision` (first-party-only and made near-unreachable by D3).
- `GET /v1/rounds` is retained for **write reconciliation**, not display — a write-only integration is undebuggable when a round goes missing.
- **006 (sync contract) leaves the critical path.** No index display means no staleness problem, so the `handicapRevision` pending/current/failed machinery has no consumer at launch. The contract still reserves the enum; 006 wires it if and when something displays an index.
- **G2 descoped:** ship the server-side events (`api_round_submitted`, `api_connect_completed` — no UI, no table, no migration). **Do not build** the public interest form, its `api_access_interest` table, or the view/submit events.

**Consequence of D9 that must not be discovered later: the third-party platform ambition is PARKED, not measured.** The 2026-10-15 review in `ADR-2026-07-29-launch-gates.md` was designed to weigh interest-form data that will now never exist, so its T2/T3 thresholds are unfalsifiable by construction. That review should default to "still first-party only" rather than wait on data. `AM-3` still governs: any non-owned consumer reopens `GOVERNANCE.md` before credentials are issued.

**Still owed by the owner (none blocking implementation):** LB-3 sign-off on `GOVERNANCE.md`; the four `RATE_LIMIT_*` env values set in Vercel; prod application of the entitlement-RPC and G4 migrations; Vercel preview env vars (`UPSTASH_REDIS_REST_URL`/`_TOKEN` exist in Production only); Node 24 before 2026-10-01; U1 (did the ~07-20 NGF Gmail follow-up actually send?).

## api.handicappin.com — LIVE (2026-07-29)

Grey-cloud CNAME + Vercel domain confirmed serving: TLS valid, cookie-less GET returns 200/204 with NO x-vercel-mitigated challenge on both `/` and `/api/trpc/*`. Closes the ingress host work and the OAuth spike custom-domain criterion. This is fitbull's base URL from its first commit.

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
- **Governance check (pre-launch):** ~~USGA/NGF fact-pattern question answered before v1 ships (fitbull publicly surfaces the unofficial WHS-method index regardless of API privacy).~~ **Substantially closed 2026-08-05 by D7/D8.** The premise in the strikethrough — that fitbull publicly surfaces the index — is **false**: fitbull will not display it (D8). LB-1's display half closes by construction. Remaining: LB-1's advertise-clause + LB-2 marks audit (both fitbull-repo, at its public release) and LB-3 owner sign-off. Neither blocks the build.
- **Web-hardening cutover** (see 6, separate gate).
- **Platform ambition — PARKED (D9), not deferred-pending-data.** The 2026-10-15 review has no demand instrumentation to read because the interest form was descoped. `AM-3` remains the live control: any non-owned consumer reopens `GOVERNANCE.md` before credentials are issued.

## Superseded/reconciled wording

- Any topic text saying "scope the Cloudflare bypass rule" is superseded by decision 4 (grey-cloud host).
- "Write-only-by-default" (topic 8) reconciled as third-party-only; fitbull polls reads per decision 7.
- The two coherent-package fork (`SYNTHESIS.md` §2.2) resolved to: **REST /v1 + OAuth B** (owner chose separate identities + linkage).
