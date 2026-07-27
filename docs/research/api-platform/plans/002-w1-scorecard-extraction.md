# 002 — W1: `submitScorecard` extraction + in-transaction limit check (accept-and-quarantine)

**Workstream:** W1 · **Status:** PENDING · **Billing-gated:** No (the closed gate makes the over-limit behavior concrete — see below)
**Depends on:** co-designed with 003 (W3 migration); the **accept-and-quarantine wiring** lands behind 003's `quarantined` column (see Ordering). The behavior-preserving extraction has **no** schema dependency and can merge first.
**Blocks:** 005 (W4) — `POST /v1/rounds` calls this service. **Merge-blocking precondition for all `/v1` work.**

---

## Goal

Extract the ~700-line `submitScorecard` pipeline (`apps/web/server/api/routers/round.ts:303`, the router file is 1117 lines) into a framework-free service `submitScorecard(deps, input)` under `apps/web/server/services/scorecard/`, with **characterization tests written first**, an **ESLint import boundary**, and an **in-transaction free-tier limit check** that replaces the post-commit delete-on-race (`round.ts:949-992`). Per the closed billing gate, over-limit rounds are **accepted and quarantined** (stored, excluded from handicap/counts, unlocked on upgrade) rather than deleted — the in-transaction check decides **active-vs-quarantined**; the delete-on-race is **deleted, not replaced with a reject**.

## Background

`submitScorecard` today is an ~700-line tRPC mutation that does everything inline: authorization, plan/limit checks, course/tee resolution (creating pending courses/tees when missing), the transactional insert of the round + submissions, provisional handicap-index computation, and admin notification. It has two billing checkpoints: a pre-transaction plan+limit check (`round.ts:332-349`, throws `FORBIDDEN` before inserting) and a **post-commit** race re-check (`round.ts:949-992`) that counts rounds via the Supabase REST API and, if over the limit, issues **5 sequential non-transactional deletes** across `submissions`, `round`, `hole`, `teeInfo`, `course` to undo the just-committed round. That compensating-delete path is the single most-converged risk in the whole research: it is nearly dormant under human traffic but becomes live under API batch-backfill concurrency (nondeterministic round deletion, corrupted handicaps on partial failure), and a committed idempotency key that outlives a deleted round replays a `201` for a nonexistent round — the exact phantom-success failure used to reject an Upstash-based dedupe.

The extraction is the merge-blocking precondition for every `/v1` handler: no REST handler may contain gating or business logic, so the pipeline must first become a location-agnostic service the handler can thinly adapt. The service takes injected side-effects (`deps`: db handle, supabase client, admin-notify fn, handicap calc) and typed **domain** errors, with **zero** framework imports — no `next/*`, no `@/env`, no tRPC/`TRPCError`, no Sentry. The tRPC `submitScorecard` procedure becomes a thin adapter that maps domain errors to `TRPCError` **in the same PR**. An ESLint rule enforces the boundary so it can't rot the way the `handicap-shared` Deno mirror did.

The billing gate is now **CLOSED** (owner, 2026-07-27): over-limit API rounds are **accepted and quarantined** — stored but excluded from handicap and from the free-tier count, unlocked when the user upgrades. So the in-transaction check does not reject the over-limit round; it marks it quarantined. This needs a schema column (`round.quarantined`), which is added in **003 (W3)** as part of the one-migration bundle. The web/native path keeps its current reject-at-limit UX for now (changing web behavior is the separate, still-open "web-hardening cutover" gate) — so the service must support **both** policies at the caller's choice: reject (web/native) vs quarantine (API). The atomic over-limit determination is shared; only the resulting action differs.

## Ordering (how this interleaves with 003)

This subplan lands in **two coherent parts**:

- **Part A — behavior-preserving extraction (no schema dependency, merges first).** Characterization tests → move the pipeline into `server/services/scorecard/submitScorecard(deps, input)` → rewire the tRPC procedure to a thin adapter → ESLint boundary. Behavior is preserved exactly, **including** the current pre-check reject and the delete-on-race, so this is a pure refactor that satisfies the "merge-blocking precondition for /v1" immediately and does not depend on 003.
- **Part B — accept-and-quarantine (lands behind 003's `quarantined` column).** Once 003's migration adds `round.quarantined` (and updates the counting/handicap sites to exclude quarantined rows), replace the pre-check reject + delete-on-race with a single **in-transaction** active-vs-quarantined decision. Part B is co-designed with 003 (the dedupe row ↔ limit-check coupling, condition **C1** below) and must land in lockstep with it.

> **Explicit ordering decision (per the split brief):** the `quarantined` column lives in **003's** bundled migration (preserving the one-migration principle); **W1 Part B lands behind 003.** Part A does not wait on 003.

## Scope (files/areas)

- **New:** `apps/web/server/services/scorecard/` — `server/` currently holds only `api/`, so this is a new sibling. Export `submitScorecard(deps, input)`:
  - `deps`: `{ db, supabase, notifyAdmins, calcHandicap, ... }` — all side-effects injected; no module-level framework imports.
  - Typed domain errors (e.g. `RoundLimitReachedError`, `PlanNotSelectedError`, `CourseResolutionError`, `SelfSubmissionError`) — plain classes/tagged unions, no `TRPCError`.
  - Over-limit **policy** parameter on `input` or `deps` (e.g. `overLimitPolicy: "reject" | "quarantine"`): web/native adapter passes `"reject"`; the `/v1` adapter (005) passes `"quarantine"`.
- **Move** logic out of `apps/web/server/api/routers/round.ts:303`–~`1010`; rewire the tRPC `submitScorecard` procedure to a thin adapter over the service **in the same PR** (Part A). The adapter maps domain errors → `TRPCError` and preserves the current self-submission guard (`round.ts:318-325`, `userId !== ctx.user.id` → `FORBIDDEN`).
- **Reuse** the shared input schema at `apps/web/types/scorecard-input.ts` (`scorecardSchema`, already consumed by `round.ts` and `scorecard.ts`) — do **not** fork it.
- **In-transaction limit check (Part B):** replace the pre-transaction check (`round.ts:332-349`) reliance on a stale count and the post-commit re-check (`round.ts:949-992`) with an advisory-lock or `SELECT ... FOR UPDATE` / serializable count **inside** `db.transaction`. Over-limit under `"quarantine"` → insert with `quarantined = true`; under `"reject"` → throw `RoundLimitReachedError` before/at insert so nothing is committed. **Delete `round.ts:949-992` entirely.**
- **Counting/handicap exclusion (coordinate with 003):** the free-tier count (`apps/web/utils/billing/access-control.ts:39-51`) and the handicap timeline must exclude `quarantined = true` rows. 003 owns the migration + query changes; this subplan owns making the service write the flag correctly and not counting quarantined rounds toward the in-transaction limit.
- **ESLint:** add an import-boundary rule in `apps/web/eslint.config.mjs` — `server/services/scorecard/**` may not import framework modules (`next/*`, `@/env`, `@/trpc`, `@sentry/*`, tRPC), and `app/api/v1/**` may not import `server/api/routers/**`.

## Step-by-step

**Part A (no 003 dependency):**
1. Write characterization tests first: assemble golden round fixtures (a representative spread — 18-hole, 9-hole front/back, course-in-catalog, course-missing-→-pending, free-tier at/over limit) and assert the **current** outputs (persisted round shape + provisional `updatedHandicapIndex` + `approvalStatus` + any pending submissions + admin-notify calls). Green against current `round.ts` behavior **before** moving code. Put them in `apps/web/tests/unit/` (pure pipeline) and `apps/web/tests/integration/` (against local Supabase for the transactional path).
2. Create `server/services/scorecard/` and move the pipeline into `submitScorecard(deps, input)` with injected side-effects and typed domain errors — **preserving behavior exactly**, including the current pre-check reject and the delete-on-race for now.
3. Rewire the tRPC procedure to a thin adapter mapping domain errors → `TRPCError`. No business logic left in `round.ts`.
4. Add the ESLint import-boundary rule; plant a deliberately-violating import and confirm `pnpm lint` fails, then remove it.
5. Re-run the characterization tests — still green (behavior-preserving).

**Part B (behind 003's `quarantined` column):**
6. Replace the pre-check + delete-on-race with the in-transaction active-vs-quarantined decision (advisory lock or serializable count inside `db.transaction`). Delete `round.ts:949-992`.
7. Wire the `overLimitPolicy`: `"reject"` throws `RoundLimitReachedError`; `"quarantine"` inserts `quarantined = true`. Ensure quarantined rounds are excluded from the in-transaction count so a quarantined round doesn't itself block the next active one.
8. Co-design the dedupe row with 003 (C1): the `externalId` UNIQUE row must be atomic with the round row — a committed key can never outlive a rolled-back or non-existent round.
9. Extend characterization/integration tests: over-limit under `"reject"` → nothing committed + typed error; over-limit under `"quarantine"` → round stored `quarantined = true`, excluded from count and handicap; concurrent submission race → no phantom deletes, no over-count of active rounds.

## Binding conditions (verbatim)

From **scorecard-write-semantics §3** (launch blockers):

> **C1 — Free-tier compensating-delete race (round.ts:949-992).** Raised independently by five perspectives; the single most-converged item on the board. A committed idempotency key/externalId row must never outlive its deleted round — that replays a 201 for a nonexistent round, the exact phantom-success failure used to reject Upstash. Move the over-limit re-check inside the transaction (or poison/clean the dedupe row with the compensation) **in the same change** as any dedupe mechanism. Not an open question; a blocker.

> **C4 — hcpStrokes parity check** (`addHcpStrokesToScores` vs stored browser-computed values on historical rounds) before any server-derivation cutover; cheap — the function already runs in the queue path. Prerequisite for Q3 either way.

From **billing-and-metering** conditions:

> 3. **The race-rollback's fate is decided at pipeline extraction, not after.** The post-hoc non-transactional delete sequence (`round.ts:949-992`) is nearly dormant under human traffic but becomes live under API batch-backfill concurrency — nondeterministic round deletion, and corrupted handicaps if a delete partially fails. The extraction spec must include an in-transaction limit check (advisory lock or serializable count) replacing the post-hoc rollback, or an explicit written reason it is safe.

From **golf-api-landscape §A** (extraction preconditions):

> 3. **Round-limit/billing gating stays inside the insert transaction** (Black). Idempotency keys cover retries, not races; a second write path must not become a paywall bypass across web/native/fitness clients.
> 4. **Integration-test coverage of billing gating and transactional recalculation is a precondition of the extraction**, plus a cross-entry-point handicap-equivalence test. No dual live submission paths: web, native, and the new consumer converge on one pipeline before the fitness app ships (Black, pre-mortem).

From **hosting-stack-decision §B** (extraction with teeth):

> 7. **Extraction with teeth.** The extraction PR that removes the inline ~700 lines from `round.ts` lands **before or with** the first `/v1` PR, plus an enforced ESLint import boundary on `server/services/scorecard/` (no `next/*`, no `@/env`, no tRPC/Sentry imports) and a rule forbidding `app/api/v1/**` from importing `server/api/routers/**`. A folder convention without a lint rule will rot exactly the way `handicap-shared` did.

From the **closed billing gate (DECISIONS §Billing gate — CLOSED)**, verbatim:

> (a) **Over-limit behavior: accept-and-quarantine.** Over-limit API rounds are stored excluded from handicap/counts and unlock on upgrade. The in-transaction check decides active-vs-quarantined; the post-commit delete-on-race (round.ts:949-992) is deleted, not replaced with a reject.

## Non-goals

- **Web/native over-limit behavior change.** The web client keeps its current reject-at-limit UX; flipping web to quarantine (or to server-derived `hcpStrokes`) is the separate, still-open **web-hardening cutover** gate (DECISIONS §6, §Open gates). Enforce the shared-schema invariant promotion (`strokes>=1`, `putts+penalties<=strokes-1`) **API-side only** (005); do not promote it into the shared zod schema here (scorecard Q3 is split out).
- Writing the migration itself (that is 003) — this subplan only writes the flag the migration adds.
- Any REST handler, OpenAPI, or rate limiting (that is 005).
- Idempotency mechanism choice — it is **locked** (externalId-primary, `UNIQUE(userId, externalId)`); this subplan only co-designs its atomicity with the limit check.

## Definition of done

- Characterization tests: golden fixtures → expected handicap index, green **before** the move and still green after (behavior-preserving).
- tRPC `submitScorecard` is a thin adapter; no business logic remains in `round.ts`; domain errors mapped in the adapter.
- Delete-on-race (`:949-992`) is **gone**; over-limit is decided **inside** the transaction — `"reject"` commits nothing, `"quarantine"` stores `quarantined = true`.
- Quarantined rounds are excluded from the free-tier count and the handicap calculation (in concert with 003).
- ESLint import boundary enforced — a violating import fails `pnpm lint`.

## Verification commands

```bash
pnpm test:unit          # characterization + limit-check race + domain-error mapping
pnpm test:integration   # transactional path against local Supabase; over-limit reject vs quarantine
pnpm check:handicap-sync # cross-entry-point handicap equivalence (web/native/service converge on one pipeline)
pnpm test:coverage      # coverage on the new service
pnpm lint               # fails on a deliberately-planted boundary-violating import
```
