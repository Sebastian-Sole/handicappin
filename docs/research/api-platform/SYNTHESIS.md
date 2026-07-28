# API Platform — Global Synthesis

**Date:** 2026-07-20 · **Scope:** 8 topics, each researched and adversarially panel-reviewed (7 perspectives per topic).
**Goal:** expose the handicappin backend so other apps can integrate; first consumer is the owner's own fitness app; longer-term option on a genuine third-party platform.

**Headline answer to the owner's question:** No stack change is required. Every topic independently concluded the current Next.js 16 + tRPC + Drizzle + Supabase + Vercel stack can host the integration surface. The real work is (1) an ingress incident fix that is due *this week* regardless of the API project, (2) extraction of the `submitScorecard` pipeline into a framework-free service, and (3) a short list of owner product decisions that gate the contract's final shape.

---

## 1. Decision table

| Topic | Consensus? | Proposed decision | Binding conditions (compressed) |
|---|---|---|---|
| **hosting-stack-decision** | ✅ Yes (conditional) | Stay on current stack; ship `/api/v1` as Next.js route handlers in `apps/web` (Option A). Serverless-timeout premise falsified — recalc is already async (`handicap_calculation_queue` + pg_cron). Extract `submitScorecard` to `apps/web/server/services/scorecard/` as `submitScorecard(deps, input)`, zero framework imports; promote to `packages/scorecard-core` only after `packages/db` exists. | Pre-scope: does fitness app share the Supabase project? Confirm Vercel plan tier + prod `DATABASE_URL` pooler. Blockers: proven Cloudflare bypass + scheduled probe; replace `round.ts:949-992` delete-on-race with in-transaction constraint; schema-level idempotency; ESLint-enforced extraction boundary. Contract-design gate for `/v1`. Instrument: Supavisor alert, postgres-js `max`, Sentry p95. 5 monitored split triggers; second Vercel project is the middle rung before any new infra. |
| **external-auth-model** | ✅ Yes (conditional) | Option B — Supabase OAuth 2.1 authorization server (beta) for fitness-app token issuance, reusing the existing Bearer+RLS path in `trpc.ts` unchanged. Option C (PAT/API-key) rejected unanimously; Option A (direct shared sign-in) is the designated fallback on the identical Bearer path. | ~2-day hardened spike as a hard gate (getUser on OAuth tokens, RLS scoping, revocation latency, `client_id` present on OAuth AND absent on first-party tokens, PostgREST/GoTrue adversarial probes incl. `auth.updateUser`, full mobile PKCE round-trip, cookie-less prod probe → permanent canary). RLS `client_id` deny-policies on billing/profile MANDATORY. Fail-closed: external tokens accepted only at `/api/v1`, rejected in tRPC. Owner answers product-identity + account-provisioning questions at the gate. Beta exit criteria written now. Budget 1.5–2.5 weeks. No external third party until real scopes exist. |
| **api-ingress-and-abuse** | ✅ Yes | Option B — dedicated `api.handicappin.com` on the same Vercel project, grey-clouded (DNS-only) Cloudflare CNAME; challenge replaced on the API path by Bearer auth + Upstash per-identity limits + one Vercel WAF rate rule + spend alerts. Path-scoped bypass rules are NOT implementable (Attack Mode overrides bypass). | Resequenced: Step 0 — three 5-min dashboard checks (which mitigation is enabled; plan tier/rule quotas; why orange-cloud + was there an attack). Step 1 — external synthetic canary BEFORE touching the firewall. Step 2 — remove/narrow challenge (incident fix, this week; host-scoped challenge rule prepped as rollback). Step 3 — audit Stripe/RevenueCat webhook deliveries for the whole challenge period now. `api.handicappin.com` is a HARD GATE — fitness app's base URL from first commit. Make `lib/rate-limit.ts` fail-closed for the public path. Host-guard negative tests; verify the 2024 Attack-Mode-precedence claim; document dashboard state in `docs/`. |
| **public-contract-shape** | ✅ Yes (conditional) | Option A — hand-written `/api/v1` REST handlers (URL-path versioning), shared zod schemas, OpenAPI 3.1 generated from those schemas, service extraction first. trpc-to-openapi and typed-tRPC-client rejected on evidence. Fitness-app v1 and future third-party surface are one artifact. | Gate 0: prove cookie-less prod path (explicit hostname-vs-bypass-rule choice + canary); confirm fitness app's actual day-1 endpoint list; decide jointly with auth topic; **owner explicitly affirms the platform bet** (else C-prime — untyped tRPC client, zero server work — is the honest baseline). PR 1: characterization tests (golden fixtures → expected index) then extraction, tRPC rewired, no business logic in handlers. Contract: Idempotency on POST /rounds day one; Upstash on every route in the creating PR; central RFC 9457 error mapper with closed code set; CI spec-parity gate; verify zod 4 `z.toJSONSchema` refinement output. Defer 12-month deprecation policy/Sunset headers until a real stranger integrates. |
| **scorecard-write-semantics** | ❌ **No (partial lock)** | DECIDED: synchronous 201 + provisional index + `handicapRevision:"pending"` (no 202/polling); idempotency state in Postgres atomic with the round row (Upstash rejected); natural-key unique index on rounds in principle (re-specified: include `nineHoleSection`, pin teeTime semantics, prod duplicate scan first); strict validation, NO auto-create of courses/tees, server-derived `hcpStrokes`/`approvalStatus`, machine-readable 422s; course/tee search-resolve read endpoint in v1 scope. | NOT decided (owner): **Q1** catalog-miss handling (catalog-only vs manual-rounds quarantine vs course-submission endpoint); **Q2** idempotency mechanism shape (Brandur key table vs externalId-primary vs natural-key-only — the research's in-transaction key table was REJECTED by the panel); **Q3** whether web/native shared-zod hardening rides in this lock or splits; **Q4** key retention (only if Q2=1). Blockers C1–C6: fix free-tier race with any dedupe change; prod dup scan; challenge bypass; hcpStrokes parity check; client 409-tolerance; backfill-friendly teeTime window. |
| **billing-and-metering** | ✅ Yes (conditional) | Option 1 — API rounds count against the existing lifetime-25 free tier identically to web/native (zero metering changes, correct by construction), plus nullable `round.submitted_via` + `round_submitted` platform property now (attribution can never be backfilled), plus explicit idempotent provisioning (never silent null→free in `submitScorecard`). | Shipping gates: close (or accept in writing) the `round` RLS insert side door before tokens reach a second app; `external_id` dedupe key in the SAME migration as `submitted_via`; extraction replaces the race-rollback with an in-transaction check; `submitted_via` is analytics-only until a client registry exists; challenge bypass + working `upgrade_url` precede the error contract; provisioning ships with the endpoint; server-side warning emails at 10/5 + day-one error-rate instrumentation. Owner gates: **A** — is lifetime-25 still the right free tier under automatic submissions (get prod round-count distribution first)? **B** — explicit yes/no on accept-and-quarantine before the RFC 9457 error contract is spec'd. |
| **two-way-sync** | ✅ Yes (amended) | Option B amended — NO eventing infrastructure in v1. Sync contract is plain REST resource reads (polling + refetch on foreground/after-submit), no cursor endpoint, webhooks deferred behind operationalized triggers. Supabase Realtime demoted to a conditional, undocumented, non-contractual internal optimization (only if auth lands shared-project JWTs; built only after polling ships). | Owner: does the fitness app have/plan a backend (if yes, hardcoded pg_net hook re-enters)? Product sign-off on ~90s foregrounded freshness. Evaluate the on-demand queue kick (~10 lines, likely ~1–2s latency) BEFORE freezing poll cadence; measure real recalc latency. Define recalc-pending vs recalc-failed semantics + queue-lag alerting; enumerate the convergence refetch set; add `updated_at` to `round` now; decide delete strategy on paper; decide billing-column exposure in profile reads. Cannot fully close until the auth topic resolves. |
| **golf-api-landscape** | ✅ Yes (conditional) | No platform distribution this cycle (no OAuth issuance, portal, self-serve keys, public docs). Keep the seam private/first-party built on the contract-hygiene work. Declare vetted-partner (Option D) as phase-2 shape behind falsifiable triggers. NGF Leverandør certification is the real platform prize; Option B improves that negotiating posture. | Cloudflare bypass named launch blocker; rate limiting + abuse alerting ship with the surface; round-limit check stays in-transaction; integration tests + cross-entry-point handicap-equivalence before launch; USGA/NGF fact-pattern question answered BEFORE v1 ships; v1 transport chosen deliberately against the null-surface alternative; write-only-by-default principle; surface marked internal/unstable until a second consumer; extraction timeboxed ~1 week with thin-wrapper fallback; demand instrumentation ships WITH v1; trigger thresholds + dated ADR + ~2026-10 review + end-Q1-2027 re-decide; internal contract doc actually written; research-record wording fixes. |

---

## 2. Cross-topic contradictions and couplings

### 2.1 The load-bearing coupling: "platform bet + shared project" gates everything

Three topics independently route to the same upstream owner question:

- **hosting** (pre-scope A.1): if the fitness app shares the Supabase project/auth, consumer #1 may need **no new REST surface at all** — the existing tRPC Bearer path already serves a first-party app.
- **public-contract-shape** (Gate 0.4): Option A is conditional on the owner **affirming the third-party platform bet**; otherwise C-prime (untyped superjson tRPC client, zero server work) is the recorded, cheaper baseline.
- **golf-api-landscape** (B.6): the null-surface v1 (fitness app over Bearer tRPC, apps/native pattern) must be **deliberately evaluated and rejected with reasons recorded** before REST is locked.

These are the same fork stated three ways. **If the platform bet is affirmed → the whole consensus package (REST `/v1` + OAuth B + contract machinery) locks coherently. If it is NOT affirmed → three topics' recommendations partially unwind** (REST /v1, OAuth consent ceremony, OpenAPI/CI machinery) and the correct v1 is the null-surface tRPC path with auth Option A. This must be the first agenda item; it is not a formality.

### 2.2 Genuine conflict: auth fail-closed placement vs the null-surface transport

- **external-auth-model** condition 3: external (`client_id`-bearing) tokens are accepted **only** at the `/api/v1` REST mount and **rejected in tRPC context**.
- **golf-api-landscape** B.6 / hosting A.1: the null-surface alternative routes the fitness app **through tRPC**.

These are mutually exclusive as stated. Only two coherent pairings exist:
1. **REST `/api/v1` + OAuth B** (client_id tokens, fail-closed at the REST mount) — the consensus package.
2. **Null-surface tRPC + auth Option A** (plain shared-project session tokens, no client_id, no consent flow) — the dissent package.

Mixing them (OAuth B tokens + tRPC transport) violates the fail-closed condition; do not let the decision drift into that combination.

### 2.3 Apparent conflict: "write-only-by-default" vs the sync contract's reads

**golf-api-landscape** B.7 declares "scorecard-in, never handicap-out" as a design principle, while **two-way-sync** locks REST polling reads of profile/rounds (handicap index out) and **scorecard-write-semantics** returns a provisional index in the 201 and requires a course/tee search-resolve read endpoint. Reconciliation: write-only-by-default applies to **third-party/phase-2 partners** (governance surface), not to the first-party consumer's private reads. The principle should be re-worded that way in the ADR, or the two topics genuinely conflict.

### 2.4 Superseded wording: bypass rules

**golf-api-landscape** A.1 and **billing** condition 5 still say "scope the bypass rule to the API path." **api-ingress-and-abuse** established this is **not implementable** (Attack Mode overrides bypass rules); the authoritative mechanism is the grey-clouded `api.handicappin.com` host + challenge removal/narrowing. Treat ingress as controlling; update the other topics' wording when recording decisions.

### 2.5 One migration, three topics

The dedupe/attribution migration is jointly constrained: **billing** #2 requires `external_id` in the **same migration** as `submitted_via`; **scorecard** Q2 (unresolved) decides what the dedupe mechanism actually is; **scorecard** C2 requires the prod duplicate scan + natural-key re-spec first; **two-way-sync** #7 wants `updated_at` on `round` now. → The migration cannot be written until Q2 is decided, and it should carry all four changes (natural-key index, external_id, submitted_via, updated_at) together. Note: hosting (schema-level idempotency) and billing (external_id dedupe key) both implicitly lean toward scorecard Q2 option 2 (externalId-primary).

### 2.6 Billing gate B (accept-and-quarantine) is upstream of two locked-looking artifacts

If the owner says yes to storing over-limit rounds in quarantine: (a) the `plan_required`/`round_limit_reached` **RFC 9457 error contract** (public-contract-shape #9, billing) changes meaning before it's spec'd, and (b) the **in-transaction limit check** that replaces the race-rollback (hosting B.5, billing #3, scorecard C1, golf-landscape A.3 — the single most-converged engineering item across all topics) changes shape, since quarantine deletes the destructive rollback entirely. Decide B before the error contract and before the extraction spec freezes.

### 2.7 RLS insert side door: the fix depends on the auth outcome

**billing** #1 (any bearer token can insert rounds via PostgREST, bypassing gating) is routed to ingress. **external-auth-model** #2's `client_id` deny-policies only cover OAuth tokens — under auth fallback A (or the null-surface path), first-party tokens carry no `client_id` and the deny-policies don't bite. In that world the only fix is DB-level (BEFORE INSERT trigger / security-definer path), which — per billing's green-hat framing — could also replace the race-rollback. One mechanism can close both findings; design them together.

### 2.8 Other couplings (no conflict, just ordering)

- **Auth topic gates two others:** two-way-sync's Realtime rider (shared-project JWTs only) and billing's provisioning attachment point both wait on external-auth-model's spike outcome; billing pins `POST /v1/profile/provision` as the auth-independent fallback.
- **Cloudflare canary is one artifact, demanded by all 8 topics** — build it once (external, non-Vercel, cookie-less, alerts on 429/HTML) and treat it as permanent infrastructure.
- **Consent page ↔ parity rules:** the OAuth consent page's `INTENTIONAL.webOnly` vs native-twin status must be settled pre-build or `pnpm parity:routes` blocks mid-build.
- **On-demand queue kick ↔ response semantics:** two-way-sync #3 (post-submit queue kick, ~1–2s) complements scorecard's provisional-index 201 and may make `handicapRevision:"pending"` resolve almost immediately — evaluate before documenting freshness numbers.
- **Governance check ↔ launch date:** golf-landscape A.5 (USGA/NGF fact pattern) is a pre-launch blocker on the whole v1, independent of engineering readiness.

---

## 3. Recommended overall shape (if all consensus decisions lock)

**Architecture:** one stack, one repo, one pipeline. No new service, no new vendor, no stack change.

- **Ingress:** `api.handicappin.com`, grey-clouded DNS-only CNAME to the same Vercel project. Main-host challenge removed/narrowed with a prepped rollback rule. External synthetic canary (cookie-less, asserts no challenge) as permanent infrastructure. Fitness app pins `api.handicappin.com` from its first commit.
- **Auth:** Supabase OAuth 2.1 server (beta) issues fitness-app tokens after a passed 2-day spike; tokens ride the existing Bearer+RLS path. `client_id` deny-policies on billing/profile tables; external tokens accepted only at `/api/v1`; forward-compatible scope claim stamped via the Custom Access Token Hook. Fallback: direct shared sign-in (A) on the identical path if the spike degenerates.
- **Service core:** `submitScorecard(deps, input)` extracted to `apps/web/server/services/scorecard/` — characterization tests first, ESLint import boundary, tRPC and REST both thin adapters, in-transaction free-tier check replacing the delete-on-race compensation, certification-shaped boundary isolating the unofficial-index calc.
- **Contract:** hand-written REST under `app/api/v1/` — URL-path versioning, shared zod schemas, OpenAPI 3.1 generated with a CI parity gate, central RFC 9457 error mapper with a closed append-only code set, marked internal/unstable until a second consumer. Day-1 surface ≈ POST /v1/rounds (idempotent), course/tee search-resolve, profile + rounds reads, provisioning. Idempotency at the schema level per scorecard Q2's outcome.
- **Write semantics:** synchronous 201 with provisional index + `handicapRevision:"pending"`; strict validation, no auto-create, server-derived fields; natural-key uniqueness on rounds.
- **Billing:** API rounds meter identically against lifetime-25 (pending gate A); `submitted_via` attribution from day one; explicit idempotent provisioning; warning emails at 10/5; error-rate instrumentation.
- **Sync:** plain REST polling + refetch-on-foreground; on-demand queue kick evaluated to collapse recalc latency; no webhooks, no cursor endpoint; Realtime at most a non-contractual internal accelerator.
- **Abuse/ops:** Upstash per-identity limits (fail-closed on the public path) + one Vercel WAF rate rule + spend alerts; Supavisor connection alert; postgres-js `max`; queue-lag alerting; Sentry-derived p95 SLO.
- **Strategy:** private first-party seam only; vetted-partner declared as phase-2 shape; demand instrumentation ships with v1; dated ADR with trigger thresholds, ~2026-10 review, end-Q1-2027 re-decide; NGF certification remains the platform prize.

**Sequencing skeleton:**
1. **This week (incident, independent of the API project):** ingress Steps 0–3 — dashboard checks, canary, challenge removal, webhook-delivery audit.
2. **Gate 0 (one owner session):** the decision agenda in §4.
3. **Auth spike** (timeboxed ~2 days, hard pass/fail).
4. **PR 1:** characterization tests + extraction + in-transaction limit check.
5. **Contract-design gate** for `/v1` (error envelope, idempotency per Q2, rate limits, eventual-consistency statement).
6. **Migration** (natural key + external_id + submitted_via + updated_at, after the prod duplicate scan).
7. **`/api/v1` PRs** — each route ships with its rate limit, error mapping, spec parity, and canary coverage.
8. **Pre-launch:** governance check documented, provisioning + upgrade_url verified end-to-end, equivalence tests green, demand instrumentation live.

---

## 4. Ordered agenda for the unresolved decisions

Only **scorecard-write-semantics** formally lacks consensus, but several consensus topics carry owner gates that are upstream of its questions. Ordered so upstream decisions come first:

### Item 0 — The platform bet, transport, and identity (upstream of everything; from three consensus topics' gates)
**Questions:** (a) Does the fitness app share the Supabase project/auth? (b) Do you affirm the third-party platform bet on a ~12-month horizon? (c) One shared product identity across your apps, or separate identities with an explicit "Connect handicappin" moment? (d) Does the fitness app have/plan its own backend? (e) What is its actual day-1 endpoint list, and where do its users play (catalog coverage estimate — feeds Q1)?
**Competing positions:** consensus package (REST `/v1` + OAuth B, one artifact for fitness app and future platform) vs the recorded dissents (C-prime/null-surface: untyped tRPC client or deep-link handoff + auth A, zero server work, migrate later). Per §2.2 these come as package deals — pick a column, not à la carte.
**Note:** answering (a)+(b) "yes/yes" locks the consensus package and the rest of the agenda proceeds within it.

### Item 1 — Billing Gate B: accept-and-quarantine, yes/no (upstream of the error contract and the extraction spec)
**Positions:** hard-reject over-limit API rounds with 403 + `upgrade_url` (research default) vs green-hat's never-evaluated alternative: store over-limit rounds excluded from handicap/counts, unlock on upgrade ("12 rounds waiting" upgrade funnel; deletes the destructive rollback).
**Decide:** explicit yes/no before RFC 9457 `plan_required`/`round_limit_reached` semantics are spec'd.

### Item 2 — Scorecard Q1: catalog-miss handling (the dominant open risk; biggest v1-scope change)
**Positions:** (1) catalog-only — accept in writing that submissions outside the 207-course Norway+Scotland catalog hard-fail with 422 (cheapest; dissent warns it may be the *modal* day-one response and starves the launch consumer); (2) "manual rounds" — accept client-supplied CR/slope/par into the existing approvalStatus quarantine, excluded from handicap until matched, no catalog writes (Strava manual-activity analogue); (3) pull the rate-limited course-submission endpoint into v1 (name-matching bug fixed first).
**Input needed:** the coverage estimate from Item 0(e).

### Item 3 — Scorecard Q2: idempotency mechanism (constrains the shared migration; billing #2 rides on it)
**Positions:** (1) full Brandur Idempotency-Key state machine (separate short claim transaction, fingerprint, response replay, purge job); (2) externalId-primary — `UNIQUE(userId, externalId)` + replay-by-lookup, header addable later non-breaking (hosting and billing conditions implicitly lean here); (3) natural-key-only 409/lookup for v1. The research's middle ground (key row inside the long transaction) was **rejected** by the panel.
**Sub-decision:** identical-body duplicate → 200 with existing round, or 409.

### Item 4 — Billing Gate A: free-tier shape under automatic submissions
**Question:** is lifetime-25 still the intended free tier once rounds arrive from an integration?
**Prerequisite input:** prod distribution of free-user round counts (currently an assumption). Reshaping changes UX cost and warning-header design, not the counting mechanics — but decide before thresholds lock.

### Item 5 — Scorecard Q3: does web/native hardening ride along or split out?
**Positions:** split the shared-zod invariant promotion (`strokes>=1`, `putts+penalties<=strokes-1`) and web cutover to server-derived hcpStrokes into a separate decision gated on the historical-data audit + hcpStrokes parity check + live-round (PR #135) regression pass (synthesizer-recommended), vs bundle and make those checks launch blockers. API-side-only enforcement is locked either way.

### Item 6 — Scorecard Q4: key retention window (only if Item 3 → option 1)
Ask the fitness app how long its offline queue can hold a round; set 24h vs 7d from that. Moot under options 2/3.

### Item 7 — Sync sign-offs (fast, from two-way-sync's owner-held facts)
Product sign-off on the ~90s-foregrounded freshness contract (or fund the queue-kick evaluation first); billing-column exposure in profile reads — strip, segregate, or explicitly accept.

---

## 5. What the research could NOT determine (open unknowns)

**Owner-held facts (five-minute questions, zero research value in guessing):**
- Fitness app: shared Supabase project? Own backend? Day-1 endpoint list? User course-coverage vs the 207-course catalog? Offline-queue hold time?
- Product intent: platform bet on a ~12-month horizon; one identity vs connect-moment; free-tier shape under automation.

**Dashboard/environment state (verify, don't infer):**
- Which Vercel mitigation is actually enabled (Attack Mode vs custom rule vs automatic); plan tier and WAF rule quotas; why the Cloudflare zone is orange-clouded and whether a real attack occurred.
- The live production `DATABASE_URL` pooler (evidence is a commented-out .env line).
- Whether Stripe/RevenueCat webhooks were silently lost during the challenge period (replay windows are closing — audit now).
- Whether real native-app users are currently hitting the 429 wall (calibrates urgency; must not delay the fix).

**Supabase OAuth beta maturity (the spike exists because these are unverified):**
- Does `auth.getUser()` accept OAuth-issued access tokens? Is `client_id` present on OAuth tokens and absent on first-party tokens? Exact PostgREST/GoTrue surface reachable with an OAuth token (incl. `auth.updateUser` account-takeover exposure)? Revocation latency and JWKS-fallback behavior? Does the pinned `supabase-js` ship the consent helpers? The custom-domain `/.well-known/oauth-authorization-server` issue? Beta→GA timeline, pricing, Phase-2 scopes (sweep the Feb–Jul 2026 changelog)?

**Empirical numbers nobody has measured:**
- Real `submitScorecard` transaction duration (Sentry traces are already 100%-sampled — read them).
- Real prod recalc latency (submit → authoritative index) and the effect of the on-demand queue kick.
- Free-user round-count distribution (feeds Gate A).
- Prod natural-key duplicate scan results (feeds the migration; use a dump, not migration history — Ballerud lesson).
- hcpStrokes parity between stored browser-computed values and `addHcpStrokesToScores` on historical rounds.

**Technical verifications pending:**
- The 2024 "Attack Mode overrides bypass rules" claim against current Vercel docs/behavior (it is the runbook's keystone).
- What zod 4 `z.toJSONSchema` emits for `scorecardSchema` refinements (they don't serialize — affects the spec-parity story).
- Whether the `enqueue_handicap_calculation` trigger fires on direct PostgREST inserts (urgency of the RLS side door).
- Whether native onboarding truly cannot set `plan_selected` (`apps/native/app/onboarding.tsx`); supabase/auth#2408 hosted-consent status (4 months stale).

**Strategic/governance unknowns:**
- Whether a public fitness app surfacing the WHS-method unofficial index changes the live USGA #151 / NGF #147 fact pattern (owner negotiation-posture call; answer before v1 ships).
- Actual third-party demand — the deferral is built on inference from a zero-self-serve landscape (dated 2026-07-20); the demand instrumentation shipping with v1 is the only planned falsifier.
- WHS Interoperability Standard PDF contents (403s to bots; characterization rests on secondary text — read manually).

---

*Per-topic syntheses: `docs/research/api-platform/topics/<topicId>/synthesis.md`. Panel reviews and research files sit alongside each.*
