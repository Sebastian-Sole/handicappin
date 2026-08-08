# 011 — Wave 2 Orchestration Map

**Date:** 2026-08-07 · **Base:** `main` @ `90429dd` (clean, no open PRs) · **Owner method:** coordinate agents, implement nothing yourself, verify every claim.

This document is the **dispatch map** for the remaining `/v1` work. It does not restate the contract or the decisions — it says *what gets built, by whom, in what order, and how each piece is proven done*.

## How to use this document

You are the orchestrator. Read `010-v1-implementation.md` §T13/§T14 and `005-phase0-contract.md` before dispatching anything — this file assumes both.

1. Dispatch every task in the current wave **in parallel**, one worktree-isolated background agent each (`isolation: "worktree"`).
2. **Agents never merge.** They push a branch and open a PR. Merging requires explicit owner authorization, obtained per cycle.
3. When an agent reports done, **verify its claims against real files and live catalogs** before advancing the wave. Agents cut corners; the previous cycle held only because every claim was checked.
4. A wave advances when its blocking tasks are *verified*, not when they are *reported complete*.

**Do not spawn agents for this plan until the owner asks.** This file is the map, not the trigger.

---

## Verified starting state (re-derived 2026-08-07, not inherited)

| Fact | Evidence |
|---|---|
| Wave 1 fully merged | PRs #180–#189, merged 2026-08-06/07 |
| `/v1` does not exist | `apps/web/app/api/` contains `ai, auth, billing, cron, legal, notifications, stripe, trpc, webhooks` — no `v1` |
| Entitlement RPC shipped | `supabase/migrations/20260805120000_get_connected_entitlement.sql` |
| Its 8 tests have never run | `tests/integration/get-connected-entitlement.test.ts` — 8 `test()` blocks behind `describeIfLocal` (`:48-49`), skipped without a local stack |
| Wave-2 rate-limit vars absent from code | `apps/web/env.ts:71-88` declares ten `RATE_LIMIT_*` keys; none of the four wave-2 names is among them |
| Quarantine never unlocks | `quarantined` written only at `server/services/scorecard/submit-scorecard.ts:344,350,793`; `utils/billing/apply-billing-event.ts` contains no reference to it |
| Billing writes are duplicated | `applyBillingEvent` is a **pure decision function**; the two write sites are `lib/stripe-webhook-handlers/profile-billing-write.ts:77` (`guardedStripeProfileWrite`) and `app/api/webhooks/revenuecat/route.ts:418+` |
| Rate-limit infra exists | `apps/web/lib/rate-limit.ts` — `createRateLimiter()`, `PUBLIC_API_PATH_PREFIX = "/api/v1"`, `PUBLIC_API_HOST`, fail-closed `publicApiLimiter` |
| Scorecard service seam exists | `server/services/scorecard/{index,submit-scorecard,errors}.ts` — `submitScorecard(deps)`, `deps.overLimitPolicy` at `:126` |
| Canary exists | `.github/workflows/ingress-canary.yml` — probes main host + `api.handicappin.com`, currently tRPC paths only |

---

## Task inventory

| ID | Task | Driver | Blocked by | Blocks | Wave |
|---|---|---|---|---|---|
| **G0** | Confirm the four `RATE_LIMIT_*` names are final | **Owner** | — | T13.0a | 0 |
| **G1** | Smoke-test `email_preferences` (toggle a preference in-app) | **Owner** | — | nothing (closes G4 gap) | 0 |
| **V1** | Execute the 8 entitlement-RPC integration tests against a local stack | Agent | — | T13.0b, T13.3, T13.4 | 0 |
| **T15** | Quarantine unlock on upgrade | Agent | D-T15 (design fork) | `/v1` ship (not T13 build) | 1 |
| **T14** | fitbull consumer handoff notes (007) | Agent | — | nothing | 1 |
| **T13.0a** | Scaffolding A — env vars + `/v1` rate limiters | Agent | G0 | T13.1–T13.4 | 1 |
| **T13.0b** | Scaffolding B — auth/principal + entitlement adapter + RFC 9457 mapper + zod | Agent | V1 | T13.1–T13.4 | 1 |
| **T13.1** | `GET /v1/health` + canary extension | Agent | T13.0a, T13.0b | — | 2 |
| **T13.2** | `GET /v1/courses` + `GET /v1/tees` | Agent | T13.0a, T13.0b | — | 2 |
| **T13.3** | `GET /v1/rounds` + round resource serializer | Agent | T13.0a, T13.0b, V1 | T13.4 | 2 |
| **T13.4** | `POST /v1/rounds` + five replay tests | Agent | T13.3 | — | 3 |
| **T13.5** | OpenAPI 3.1 spec + CI parity check | Agent | T13.1–T13.4 | — | 4 |
| **DoD** | End-to-end verification against `010` §Definition of done | Orchestrator | all | launch | 4 |

**Owner-only, not on the critical path:** LB-3 sign-off on `GOVERNANCE.md` (gates fitbull's public release) · Node 24 before 2026-10-01 · the #185 commit-message disclosure decision · U1 (did the ~07-20 NGF Gmail follow-up send) · fitbull-repo LB-1/LB-2 audit at its public release.

---

## Dependency graph

```
WAVE 0 ─ de-risk + unblock
  G0 (owner: freeze env var names) ──────────────┐
  G1 (owner: email_preferences smoke)  [isolated]│
  V1 (run 8 entitlement tests) ─────────┐        │
                                        │        │
WAVE 1 ─ parallel build                 │        │
  T14  fitbull notes      [independent] │        │
  T15  quarantine unlock  [independent] │        │
  T13.0a env + limiters ◄───────────────┼────────┘
  T13.0b auth + entitlement + mapper ◄──┘
                    │
WAVE 2 ─ routes (all three parallel)
  T13.1 GET /health ──┐
  T13.2 GET /courses+/tees ──┼── all need 0a + 0b
  T13.3 GET /rounds ──┘
        │
WAVE 3
  T13.4 POST /rounds  (needs T13.3's serializer)
        │
WAVE 4
  T13.5 OpenAPI + CI parity
  DoD   end-to-end verification
```

**Critical path:** `V1 → T13.0b → T13.3 → T13.4 → DoD`. Everything else has slack. T14 and T15 never touch it — dispatch them first so they are done long before they are needed.

---

## Wave 0 — de-risk and unblock

### G0 — Freeze the rate-limit variable names *(owner)*

The four names already live in Vercel Production and Preview:

```
RATE_LIMIT_ROUNDS_WRITE_PER_MIN=60
RATE_LIMIT_API_READS_PER_MIN=120
RATE_LIMIT_COURSE_SUBMIT_PER_HOUR=10
RATE_LIMIT_PROVISION_PER_HOUR=5
```

They freeze the moment T13.0a writes them into `env.ts`. Renaming afterwards means a code change **and** a Vercel change in two environments. Only the first two have a day-one consumer — D9 defers the endpoints the other two guard.

**Default if the owner does not respond:** adopt the four names verbatim and proceed. This is a rename cost, not a correctness risk.

### G1 — `email_preferences` smoke test *(owner)*

Toggle an email preference in the running app. This is the one surface `20260807090000_g4_column_grant_sweep.sql` (lines 185–204) hardened but which **cannot** appear in a deny-list probe — the migration revokes INSERT/UPDATE at table level then re-grants `user_id`, `feature_updates`, `updated_at`, so a passing probe proves nothing. Live write path: `server/api/routers/auth.ts:60` and `:94`.

Failure mode is a runtime `42501` breaking the feature — narrow, not a security hole. Blocks nothing; it closes the last open question from the G4 sweep.

### V1 — Execute the entitlement-RPC integration tests *(agent)*

**Why this is first:** every `/v1` entitlement decision routes through `get_connected_entitlement()`. The anon probe run last cycle proved the function *exists and is locked down* — not that it *returns correct values*. Eight tests were written for exactly this and have never executed anywhere. If they fail, T13.0b and everything downstream is built on a wrong foundation.

**Scope:** start a local Supabase stack, run `pnpm --filter web test:integration tests/integration/get-connected-entitlement.test.ts`, report the real result. **Fix nothing** — if a test fails, report the failure with output and stop. A failing test here is a finding that reshapes the wave, not a bug to patch in passing.

The eight tests cover: no profile row → zero rows; `plan_selected NULL` → not provisioned; free plan counts non-quarantined rounds only; lifetime → unlimited; premium → unlimited; anon `42501`; OAuth `client_id` token gets only its own user's row; response carries only the four derived facts.

> **Environment hazard — read before touching env files.** `apps/web/.env` points at the **LOCAL** stack. `supabase/.env.local`'s default-named vars (`DATABASE_URL`, `DIRECT_URL`, `SUPABASE_DB_URL`) point at **PRODUCTION**; local is behind `LOCAL_*`. Anything that sources that file wholesale runs against prod under conventional names. The test guards on `isLocalStack` (`:48-49`) — do not weaken that guard to make tests run.

**Done when:** 8/8 pass with output pasted, *or* the failures are reported verbatim and undiagnosed-by-the-agent. Orchestrator re-runs the command independently before believing either.

---

## Wave 1 — parallel build

### D-T15 — Design fork to settle before dispatching T15

`applyBillingEvent` is **pure** — it returns an `ApplyDecision`, it does not write. Side effects belong at the two write sites, which are *not* shared:

- `lib/stripe-webhook-handlers/profile-billing-write.ts:77` — `guardedStripeProfileWrite`
- `app/api/webhooks/revenuecat/route.ts:418+` — inline projection write

Three viable shapes. Pick one before dispatching, or the agent will pick badly:

1. **Shared server helper** called from both write sites when a decision is `action: "apply"` and the resulting projection is a paid plan. Explicit, testable, but must be wired twice and a third provider would have to remember it.
2. **Database trigger** on `profile` plan transitions. Impossible to forget, applies to every writer including manual SQL — but it is a migration, invisible in application code, and this database has a history of drift.
3. **Unlock-on-read** — compute active-vs-quarantined at read time instead of storing it. Rejected on sight: the column exists precisely to be authoritative, and three read sites already filter on it.

**Recommendation: option 1.** It matches the repo's existing posture (server-written rounds, chokepoint discipline) and is provable with revert-the-fix testing. Option 2's invisibility is the wrong trade in a database that has carried a history row for DDL that never ran.

**Second question the agent cannot decide:** unlocking rounds changes the handicap, so the unlock must enqueue a recomputation (`handicap_calculation_queue`, `db/schema.ts:707`). Confirm that the unlock path enqueues rather than computing inline — a webhook handler is the wrong place to run a handicap calculation.

### T15 — Quarantine unlock on upgrade *(agent, TDD)*

The contract at `005-phase0-contract.md:245` promises: *"excluded from the handicap computation and from the account's round count until the account upgrades, at which point it is unlocked automatically — no resubmission is needed."* Nothing implements this. It is a **hard blocker on `/v1` shipping**, though not on T13's build.

**Write the failing test first.** Integration test: user at the free-tier limit, one quarantined round, apply a paid billing event, assert the round becomes `quarantined = false`, is counted, and a recomputation is enqueued. It must fail before the fix exists.

**Must cover:** Stripe path and RevenueCat path, both. Lifetime and premium. Idempotency — a replayed billing event must not double-enqueue. Downgrade must **not** re-quarantine (no decision exists for that; do not invent one — leave rounds unlocked and note the gap).

**Revert-the-fix verification is mandatory:** remove the unlock call, confirm *exactly* the expected assertion fails and nothing else, restore.

### T14 — fitbull integration notes *(agent)*

Depends only on the frozen contract. **Dispatch immediately, in parallel with everything.** Spec at `010-v1-implementation.md:132`; the target doc is `007-w6-fitbull-integration-notes.md`.

Must state: base URL `api.handicappin.com` · the five day-one endpoints and that `GET /v1/profile` **does not exist yet** · `externalId` idempotency incl. the `409 idempotency_conflict` prose at `005-phase0-contract.md:166` · quarantine-status handling and that `status`/`handicapRevision` are **extensible enums** (unknown ⇒ not active / not current) · the reads budget as a stated ceiling on polling cadence (D6) · and as hard requirements, **LB-1's advertise-clause and LB-2's marks audit** (D8) — no handicap-feature advertising to US-market users, zero WHS marks in UI, store listing or marketing.

Doc-only: no code, no migration.

### T13.0a — Scaffolding A: env + `/v1` rate limiters *(agent)*

Declare the four wave-2 vars in `apps/web/env.ts` following the existing pattern at `:71-88` (`z.coerce.number().int().positive().default(...)`) and add them to the `runtimeEnv` block at `:142-155`. Build the `/v1` limiters on `createRateLimiter()` in `lib/rate-limit.ts`, keyed **per `(client_id, user)`**, sliding window, **fail-closed** (D6, `005-phase0-contract.md` §3).

**The fail-closed trap, stated so it is not rediscovered:** when `RATE_LIMIT_ENABLED` is not explicitly `"true"`, `limiterUnavailableReason="disabled"` leaves `publicApiLimiter` null and `/v1` **denies 100% of requests**. Vercel builds run `NODE_ENV=production`, so Preview must set it explicitly. It is already set — do not "fix" it by loosening the refine at `env.ts:63-70`.

No route handlers in this PR. Touches `env.ts` and `lib/rate-limit.ts` only — chosen so it cannot collide with T13.0b.

### T13.0b — Scaffolding B: auth, entitlement, errors, schemas *(agent)*

Four pieces, one PR, no route handlers:

- **RFC 9457 problem+json mapper** — the closed, append-only code set from `005-phase0-contract.md` §1. `plan_required` = 403 · `course_not_found` = 422 · SQLSTATE `42501` → 403 `forbidden` · wrong content type → 400 `malformed_request` · `409 idempotency_conflict`. **`round_limit_reached` does not exist and must not be added** — over-limit is a 201 with a status.
- **Entitlement adapter** — injects `get_connected_entitlement()` as `getUserAccess`. Gated on V1 passing.
- **Bearer-token principal extraction** — `client_id` + `scope` claims; missing/revoked token or a client token without a `scope` claim → 401 `unauthorized`; scope-insufficient → 403 `forbidden` (`005-phase0-contract.md` §6).
- **Shared zod schemas** reusing `types/scorecard-input.ts`. The `teeTime` window (`1990-01-01 … now+24h`, D5) is a **`/v1`-only refinement layer** → 422 with a field-level code. **Do not tighten the shared schema** — the web and native paths consume it, and narrowing validation after ship is a breaking change requiring `/v2`.

### Wave 1 collision check

Four agents, four disjoint file sets — safe to run concurrently in worktrees:

| Task | Touches |
|---|---|
| T15 | `utils/billing/*`, `lib/stripe-webhook-handlers/*`, `app/api/webhooks/revenuecat/*`, `tests/integration/` |
| T14 | `docs/research/api-platform/plans/007-*.md` |
| T13.0a | `apps/web/env.ts`, `apps/web/lib/rate-limit.ts` |
| T13.0b | `apps/web/app/api/v1/_lib/**` (new), `apps/web/lib/api/**` (new) |

T13.0b creates the `app/api/v1/` tree first — Wave 2 agents branch from it after it merges.

---

## Wave 2 — the read routes (three agents in parallel)

Every route ships **in the same PR as** its rate limit, its RFC 9457 error mapping, and its canary coverage. **No business logic in handlers.** Security review is mandatory per route, paired with revert-the-fix verification.

**Host scoping applies to all three:** `api.handicappin.com` is the only supported base host. Changing it means updating **both** api-host probes added in PR #170.

### T13.1 — `GET /v1/health` + canary

The canary target, and the smallest possible end-to-end proof that the scaffolding works. Extend `.github/workflows/ingress-canary.yml` — it currently probes tRPC paths on both hosts; add a `/v1/health` probe on `api.handicappin.com`. Decide and document whether health is authenticated (recommend: unauthenticated, no data, rate-limited — a canary that needs a token cannot run from GitHub-hosted runners).

### T13.2 — `GET /v1/courses` + `GET /v1/tees`

Catalog reads. Reuse the existing tRPC read logic — `server/api/routers/course.ts` has `getCourseById:8` and `searchCourses:54` as `publicProcedure`; `server/api/routers/tee.ts` is the tee equivalent. Extract shared query logic rather than duplicating it. Reads limiter (`RATE_LIMIT_API_READS_PER_MIN`). A referenced `teeId`/`courseId` not in the catalog → 422 `course_not_found`.

### T13.3 — `GET /v1/rounds` + the round resource serializer

**On the critical path.** This route owns the round resource shape that `POST /v1/rounds` reuses verbatim — build it here, deliberately, as a shared serializer.

The body carries `handicapIndex` (provisional), `handicapRevision`, and `status`. Both enums are **extensible**. `status` must reflect `quarantined` — a quarantined round appears in the list with a distinguishable status (D4 precedent: `server/api/routers/round.ts:63-66` deliberately does **not** filter quarantined rounds out of lists; it filters them out of handicap-derived statistics at `:104` and `:159`).

Entitlement decisions route through the T13.0b adapter.

---

## Wave 3 — `POST /v1/rounds`

### T13.4 — the write path *(agent, TDD, security review mandatory)*

The single highest-risk task in the plan. It calls the 002 service with `overLimitPolicy: "quarantine"` (`server/services/scorecard/submit-scorecard.ts:126`) and adds no business logic of its own.

**Non-negotiable contract invariants** (all frozen in 005 Phase 0):

- **201 synchronously.** Never 202. Never 200 on first write. Never 403 for over-limit.
- Over-limit ⇒ **201 + `status: "quarantined"`**. No `round_limit_reached` code exists on this surface.
- `externalId`-primary idempotency, replay-by-lookup. A matched `externalId` **wins** over a simultaneous natural-key collision. Keyed on `UNIQUE("userId","externalId")` (NULLS DISTINCT) from `20260730120000`.
- The 200 replay body uses the **identical shape** as the 201.
- `plan_required` = 403 when the account has not completed plan selection.
- `teeTime` outside `1990-01-01 … now+24h` → 422 with a field-level code, via the `/v1` refinement layer only.

**Five merge-blocking replay tests. One must force genuine concurrency** — hold the winner's transaction open so the loser truly contends. A naively parallel test passes for the wrong reason: it races two requests that never actually overlap in the database, proves nothing, and looks green. The five: (1) same `externalId` same contents → 200 replay, identical body; (2) same `externalId` different contents → 409 `idempotency_conflict`; (3) `externalId` vs natural-key collision → `externalId` wins; (4) **forced-concurrency** double submit → exactly one insert; (5) over-limit → 201 + `quarantined`, excluded from count and handicap.

**Revert-the-fix on the security-relevant guards:** remove each, confirm exactly the expected assertion fails, restore.

---

## Wave 4 — close out

### T13.5 — OpenAPI 3.1 + CI parity

Spec covering the five shipped endpoints, plus a CI check that fails when handlers and spec diverge (`005-w4-v1-contract-and-handlers.md` scope). Runs last so it describes what actually shipped rather than what was planned.

### DoD — end-to-end verification *(orchestrator, not an agent)*

Against `010-v1-implementation.md` §Definition of done. Verify by exercising the API, not by reading agent reports:

- [ ] A token-holding consuming app can `POST /v1/rounds` and receive 201 with a provisional index
- [ ] A replayed `externalId` returns the same round
- [ ] An over-limit round returns 201 + `status: "quarantined"`, excluded from both the count and the handicap
- [ ] **Upgrading unlocks it automatically (T15) and enqueues a recomputation**
- [ ] `GET /v1/rounds` reflects what landed
- [ ] All five routes rate-limited, error-mapped, canary-covered, security-reviewed
- [ ] Owner has closed LB-3 before fitbull is publicly released

---

## Verification protocol — non-negotiable

Applies to every task above. These exist because each one has already cost this project real time.

1. **Verify applied DDL against a dump or the live catalog — never the migration-history table.** This database has carried a history row for DDL that never ran, and every submission 500'd for a day because of it.
2. **Revert-the-fix on every security fix.** Remove the guard, confirm *exactly* the expected assertion fails and nothing else, restore. A test that passes both with and without the guard is testing nothing.
3. **Integration suites skip in CI** (they need a live local DB). Green CI does **not** prove migrations or RLS work. Verify by attack.
4. **Treat `claude[bot]` reviews as leads, not verdicts.** Last cycle it was unreliable in *both* directions — a Critical with a real conclusion but a fabricated exploit chain, and a Critical that ran four minutes *before* the PR it claimed did not exist was created. Check review timestamps against branch creation times before believing an "it doesn't exist" finding.
5. **Spot-verify every agent claim against real files.** Re-derive from source before relaying upward — a prior session lost five successive checkable claims to reasoning off the previous message instead of the repo.
6. **Migrations auto-apply on merge.** `.github/workflows/migrate.yml:71` — `if: ${{ success() && (github.event_name == 'push' || inputs.apply) }}` — fires on `push` to `main`. Merging a migration *is* applying it to production. Renumber out-of-order migrations; never `--include-all`; never edit an already-applied file, not even a comment.

## Environment hazards live during this cycle

- **pnpm 11 fires from pre-commit hooks**, not just `pnpm build:seed`. It rewrites `packageManager` to `11.20.0`, regenerates ~2990 lockfile lines and injects `allowBuilds` into `pnpm-workspace.yaml`. **Check `git status` for `package.json` / `pnpm-lock.yaml` / `pnpm-workspace.yaml` after any hook-running commit**; revert with `git checkout --`.
- Detached worktrees (`git worktree add --detach <path> origin/<branch>`) avoid "branch already checked out in another worktree" and leave the owner's tree untouched. Push with `git push origin HEAD:<branch>`.
- `git reset --hard` is blocked by the command classifier. Use `git checkout -B <branch> origin/main`.
- Foreground `sleep` is blocked. Use `Monitor` with a poll loop, or `run_in_background`. For multi-PR waiting, prefer a simple sequential `for pr; do while ...; done` over clever dedup logic.
- Split `git` and `gh` into separate Bash calls. zsh does not word-split unquoted variables — loops over `"a b"` need `bash -c`.
- Pre-PR gate, every branch: `pnpm lint`, `test:unit`, `test:integration`, `parity:routes`, `parity:styles`, `check:schema-sync`, `check:handicap-sync`.
- Commit trailer: `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`.

## Reference set — read before dispatching

| Document | Why |
|---|---|
| `010-v1-implementation.md` | Master plan. §T13/§T14 are the spec this map schedules. |
| `005-phase0-contract.md` | The frozen `/v1` contract. Every invariant above traces here. |
| `DECISIONS.md` §"Sign-off: pre-implementation decision set" | **D1–D9 are LOCKED.** A review comment arguing against one is invalid-by-decision. |
| `003-notes.md` | Duplicate semantics, write-path posture. |
| `000-INDEX.md` | Workstream status. Its "PRs open, none merged" line is stale — #180–#189 all merged 2026-08-06/07. |
