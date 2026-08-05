# 010 — `/v1` Implementation Master Plan

**Date:** 2026-08-05 · **Status:** READY TO DISPATCH · **Supersedes nothing; sequences everything.**

**Binding inputs (read these, do not duplicate them):**
- `DECISIONS.md` §"Sign-off: pre-implementation decision set (owner, 2026-08-05)" — **D1–D9, the nine decisions this plan executes.** Every scope question below traces to one of them.
- `plans/005-phase0-contract.md` — the frozen `/v1` contract. **Build against this.** Its four owner sign-off items are now closed; four statements in its body are stale (see T7).
- `plans/003-notes.md` — duplicate semantics, write-path posture, prod-apply checklist, contract carry-forwards.
- `ADR-2026-07-29-launch-gates.md` §5.1 — the PostgREST column-grant invariant (G4).
- `GOVERNANCE.md` — the WHS/USGA/NGF fact pattern; §4 carries a 2026-08-05 amendment.

## The goal, in one line

fitbull writes a golf round into a user's handicappin account through `POST /v1/rounds`, and can read back what landed. Everything else is scaffolding.

## What exists as of 2026-08-05

Verified on `main` @ `0803768`:

| Piece | State |
|---|---|
| OAuth consent flow | Live in production — `app/oauth/consent/page.tsx` |
| Scorecard service extracted (002 Part A) | Merged — `server/services/scorecard/` |
| `round` natural key + `externalId` + `submitted_via` + `quarantined` | Applied to prod — `20260730120000` |
| Column-grant hardening on `round` + `score` | Applied to prod — `20260730090000` |
| Frozen `/v1` contract | Merged (PR #174) |
| Launch gates + governance | Merged (PR #175) |
| **`apps/web/app/api/v1/`** | **Does not exist. No route has been written.** |
| `overLimitPolicy: "quarantine"` | **Throws** — `submit-scorecard.ts:281-283` |
| `get_connected_entitlement()` | **Does not exist anywhere in the repo** |

## Day-one scope (D9)

**Build five endpoints:** `POST /v1/rounds` · `GET /v1/courses` · `GET /v1/tees` · `GET /v1/rounds` · `GET /v1/health`

**Do not build:** `GET /v1/profile` · `POST /v1/courses` · `POST /v1/profile/provision` · the G2 interest form, its table, or its view/submit events · anything from 006 beyond what `GET /v1/rounds` needs.

`GET /v1/rounds` exists for **write reconciliation**, not display — fitbull never renders a handicap (D8). A write-only integration is undebuggable when a round goes missing.

---

## Wave 1 — dispatchable now, in parallel

All twelve are mutually independent. Nothing here waits on anything else here.

### T1 — 002 Part B: accept-and-quarantine `[HARD BLOCKER for T13]`
**Files:** `server/services/scorecard/submit-scorecard.ts`, `server/api/routers/round.ts`
1. Replace the throw at `submit-scorecard.ts:281-283` with a real in-transaction active-vs-quarantined decision writing `round.quarantined`.
2. **Delete** the post-commit compensation block at `submit-scorecard.ts:~920-931` (the delete-on-race). Do not replace it with a reject — the billing gate explicitly refused rejection.
3. Narrow `SubmitScorecardDeps.getUserAccess` (`:116`) to `Pick<FeatureAccess, "hasAccess" | "plan" | "remainingRounds">`. The service reads only those three; this means the `/v1` adapter fabricates one field instead of seven.
4. `round.ts:180` keeps `overLimitPolicy: "reject"` — the web path is unchanged by this task.

**Tests (TDD, per the contract's merge-blocking list):** over-limit submission is accepted and stored with `quarantined = true`; an at-limit race does not double-count; quarantined rounds are excluded from both counting sites and from the handicap computation.

### T2 — Quarantine UI: badge in lists, filter from stats (D4)
**Files:** `server/api/routers/round.ts`, the list/stat components, **plus the same-slug native screens**
1. `getBestRound` (`round.ts:145-150`) — add `.eq("quarantined", false)`. It currently orders by `scoreDifferential ASC LIMIT 1` with no filter and **can return a quarantined round as the user's best**, contradicting the handicap that `scoreDifferential` feeds. Sweep for any other aggregate with the same shape.
2. `getAllByUserId` (`round.ts:63-69`) — **do not filter.** Surface `quarantined` so the UI can badge it: visible, marked "not counted — free-tier limit reached", with an upgrade path.
3. **Web↔native parity binds here** (`.claude/rules/web-native-parity.md`). Run `pnpm parity:drift`; port the badge to the same-slug native screen; styling from `@handicappin/tokens` only (`pnpm parity:styles` blocks literals).

### T3 — `get_connected_entitlement()` RPC `[HARD BLOCKER for T13]`
**New migration.** SECURITY DEFINER, `search_path = ''`. Returns **only** derived facts: `is_provisioned`, `has_unlimited_rounds`, `rounds_limit`, `rounds_used`. Never plan name, subscription status, period, or payment ids. `rounds_used` counts **non-quarantined rounds only** (contract §1). Zero rows (no profile row at all) is a valid, reachable result → the adapter maps it to `403 plan_required` **plus a Sentry alert**. Spec is in the contract §1; do not re-derive it.
**Owner applies to prod.** Agent authors, tests locally, and provides the verification probe.

### T4 — `teeTime` / `createdAt` timezone display bug `[do before T13]`
`round.teeTime` and `createdAt` are naive `timestamp` columns. PostgREST returns them zone-less; the UI does `new Date(value)`, which JS parses as **local** while the stored value is the UTC rendering. Norwegian summer effect: times display ~2h early and late-evening rounds show the previous date. Drizzle's read path is correct (it reconstitutes with `+0000`), so **only PostgREST-fed reads are affected**.
**Call sites:** `components/homepage/home-page.tsx`, `components/dashboard/dashboard.tsx`, `roundsTable.tsx`, `round-calculation.tsx`.
**Why it gates T13:** D5 freezes a `teeTime` window evaluated against these columns. Boundary-day rounds are exactly where this defect bites.

### T5 — Gate the OAuth consent page on plan selection (D3)
**File:** `app/oauth/consent/page.tsx`
Currently gates only on `supabase.auth.getUser()` (`:86`) and never checks `plan_selected`, so a plan-less account can be issued a token that can only ever `403`. Add the check; redirect to onboarding; resume the pending authorization afterwards. The equivalent redirect already exists at `app/auth/callback/route.ts:335`, and the `?redirect=` resume path is already open-redirect-guarded by `safeInternalPath` — **reuse both, do not invent a new mechanism.**
Owner's note: users effectively cannot use handicappin without selecting a plan, so the affected population is expected to be ~zero. This is preventative.

### T6 — G4: PostgREST column-grant sweep
Apply the `ADR-2026-07-29-launch-gates.md` §5.1 invariant to **every remaining PostgREST-reachable table**. `round` and `score` are done and verified. Remaining: `profile`, `course`, `teeInfo`, `hole`, `submissions`, `stripeCustomers`, `webhookEvents`, `pendingLifetimePurchases`, `handicapCalculationQueue`, `emailPreferences`, `pendingEmailChanges`, `otpVerifications`, `legalConsents`.
**Two traps, both of which produced wrong first answers last cycle:** (a) column-level revokes are no-ops while the table-level grant is held — `revoke <verb> on <table>` first, then re-grant per column, **in one transaction**; (b) a `WITH CHECK (auth.uid() = "userId")` policy proves row ownership, not what the row *points at* — child rows need an `EXISTS` against the parent. Do not carry a uuid-column result over to a text column (case/whitespace bypass).
**Owner applies to prod.**

### T7 — Contract-doc corrections
Fix in one pass on `005-phase0-contract.md`; carry-forwards already recorded in `003-notes.md`:
- **§249 / §256** describe the direct-PostgREST-insert side door as an open shipping gate — **it is closed.**
- **§253** describes the UPDATE grant as an exclusion list, implying gameplay/rating columns are still writable — they are not.
- **§162** justifies the `409 idempotency_conflict` rule on rounds being editable "by the user in the web app, and by the OAuth token itself via PostgREST" — **both halves are false**; no round-edit flow exists in web or native. **The 409 rule itself survives** on a narrower true premise: `notes` is a compared field per §157 and is the one column still client-writable. Do **not** substitute "the recompute rewrites derived fields" — §162 explicitly excludes those from comparison.

### T8 — `000-INDEX.md` status refresh
Its status table still says every workstream is PENDING. Actual: 001 partial, 002 Part A merged, 003 merged+applied, 004 merged (consent live), 005 Phase 0 merged, 008 merged. Refresh the table and the dispatch order; point the reader at this plan for what happens next.

### T9 — 009: OAuth audit-log auto-revoke + toggle watchdog
Subplan `009-oauth-detect-and-revoke.md` is merged and dispatchable. Blocks nothing, trails nothing.

### T10 — Low-severity findings batch (one PR)
- `round.approvalStatus` has no CHECK constraint. No handicap bypass (all consumers fail closed) **but `activity-transform.ts` fails *open*** and would badge a junk value as approved.
- `score.holeId` has no insert-time integrity check against the round's tee.
- Flaky unit test seeded with `Math.random()` — `tests/unit/statistics/test-fixtures.ts`.
- `round.ts:370` name-only course matching, which contradicts the `(name, country, city)` unique index. Was a prerequisite for `POST /v1/courses`; that endpoint is deferred (D9), but the bug is real — fix it here.

### T11 — `--yes` on `supabase db push`
`migrate.yml` does not pass `--yes`. The CLI auto-confirms in non-TTY today, but a future CLI treating EOF as "no" would silently no-op while the step exits 0.

### T12 — G2 server events only (D9)
Add `api_round_submitted` and `api_connect_completed` per `DEMAND_INSTRUMENTATION.md` §3.3/§3.4. Server-side, no UI, no table, no migration. **Do not build** the interest form, the `api_access_interest` table, or `api_access_interest_viewed`/`_submitted`. Honour the hard PII rule: `distinctId` is the Supabase user id; never put email or free text into properties.

---

## Wave 2 — gated on T1 + T3 merged and the RPC applied to prod

### T13 — The five `/v1` routes
New tree `apps/web/app/api/v1/`. **Build order:** `GET /health` (canary target) → `GET /courses` + `GET /tees` → `GET /rounds` → `POST /rounds`.

Every route ships **in the same PR as** its rate limit, its RFC 9457 error mapping, and its canary coverage. No business logic in handlers — `POST /v1/rounds` calls the 002 service with `overLimitPolicy: "quarantine"`.

**Shared scaffolding first:** zod schemas reusing `types/scorecard-input.ts`; the RFC 9457 problem+json mapper with the closed, append-only code set; the entitlement adapter injecting `get_connected_entitlement()` as `getUserAccess`.

**Contract invariants that are not negotiable** (all frozen in 005 Phase 0):
- `POST /v1/rounds` → **201 synchronously**, never 202, never 200 on first write, never 403 for over-limit.
- Body carries `handicapIndex` (provisional), `handicapRevision`, `status`. Both enums are **extensible**: unknown `status` ⇒ not active; unknown `handicapRevision` ⇒ not current.
- Over-limit ⇒ **201 + `status: "quarantined"`**. No `round_limit_reached` code exists on this surface.
- `externalId`-primary idempotency, replay-by-lookup; a matched `externalId` **wins** over a simultaneous natural-key collision.
- `plan_required` = 403; `course_not_found` = 422; SQLSTATE 42501 → 403 `forbidden`; wrong content type → 400 `malformed_request`.
- `teeTime` outside `1990-01-01 … now+24h` → **422** with a field-level code (D5), enforced as a `/v1` refinement layer — **do not tighten the shared schema.**

**Rate limits (D6), per `(client_id, user)`, sliding window, fail-closed.** New env vars following the `env.ts:71-88` pattern: writes 60/min, reads 120/min, course-submit 10/hr, provision 5/hr.

**Host-scoping carry-forward:** `api.handicappin.com` is the only supported base host. Updating it means updating **both** api-host probes added in PR #170.

**Merge-blocking replay tests** (contract §2): five of them, **one requiring forced concurrency rather than naive parallelism.**

**Security review is mandatory** on every route, paired with revert-the-fix verification.

### T14 — 007 fitbull integration notes
Handoff doc for the Convex repo. Must state: base URL `api.handicappin.com`; the five available endpoints and that `GET /v1/profile` does not exist yet; `externalId` idempotency; quarantine-status handling; **the reads budget as a stated ceiling on polling cadence** (D6); and — as hard requirements, not nicities — **LB-1's advertise-clause and LB-2's marks audit** (D8): no handicap-feature advertising to US-market users, zero WHS marks in UI, store listing or marketing.

---

## Owner-only (cannot be delegated)

**Blocking wave 2:** apply the T3 entitlement-RPC migration to prod · set the four `RATE_LIMIT_*` env vars in Vercel.
**Not blocking:** apply the T6 G4 migration · LB-3 sign-off on `GOVERNANCE.md` · Vercel **preview** env vars (`UPSTASH_REDIS_REST_URL`/`_TOKEN` exist in Production only) · Node 24 before 2026-10-01 · U1 — confirm whether the ~07-20 NGF Gmail follow-up actually sent · fitbull-repo LB-1/LB-2 audit at its public release.

## Migration operations — hard-won, do not rediscover

- `migrate.yml` has a manual trigger. `apply` defaults to **false** = dry-run. Drift check: `gh workflow run migrate.yml --ref main -f apply=false`. Apply-before-merge: same with `--ref <branch> -f apply=true`. A dispatch reads the workflow file **from the ref it runs on**, so branches cut before PR #178 need a rebase onto main first.
- **Out-of-order migrations: renumber, don't `--include-all`.** Keep remote history monotonic; this database has drifted before.
- **Never edit an already-applied migration file**, even a comment.
- **Verify post-deploy against a dump or the live catalog — never the migration-history table.** This database has carried a history row for DDL that never ran.
- Verifying DDL without credentials: probe PostgREST with the public anon key for each new column **plus a deliberately non-existent control column** — 200 vs `42703` proves both existence and that the check discriminates. Don't print the key.
- Local CLI cannot reach `db.<ref>.supabase.co` (IPv6-only). Use the session pooler for repair work only; **prefer the workflow for applies.**

## Method (owner's explicit instruction)

> "You do none of the implementation, you coordinate agents… Agents can lie, cheat and cut corners, so it is your job to validate and verify."

- Worktree-isolated background agents, one task each. **Agents never merge.**
- **Revert-the-fix testing on every security fix:** remove the guard, confirm *exactly* the expected assertion fails and nothing else, restore.
- Spot-verify agent claims against real files and live catalogs. Every claim checked last cycle held — because it was checked.
- **Treat `claude[bot]` reviews as leads, not verdicts.** Last cycle it scored 2/5 on two PRs and was unreliable in *both* directions: a Critical with a real conclusion but a wrong exploit chain; a Critical that ran four minutes before the PR it claimed did not exist was created. Verify every claim against the code, and check review timestamps against branch/PR creation times before believing an "it doesn't exist" finding.

## Environment gotchas still live

- **`apps/web/.env` points at the LOCAL stack.** `supabase/.env.local`'s default-named vars (`DATABASE_URL`, `DIRECT_URL`, `SUPABASE_DB_URL`) point at **PRODUCTION**; local is behind `LOCAL_*`. Anything sourcing that file wholesale hits prod under conventional names.
- Integration suites **skip in CI** (they need a live local DB), so green CI does not prove migrations or RLS work. **Verify by attack.**
- A branch may be checked out in an agent worktree, blocking a normal checkout. Use detached HEAD + `git push HEAD:refs/heads/<branch>`.
- `git reset --hard` is blocked by the command classifier. `git checkout -B <branch> origin/main` rebases a fresh branch without destroying working-tree changes.
- zsh does not word-split unquoted variables — harnesses looping over `"a b"` need `bash -c`.
- pnpm only; root-level `pnpm` can invoke pnpm 11 against the pinned 10.33.0 and strip lockfile overrides — prefer `bash scripts/build-seed.sh`, and revert any `pnpm-lock.yaml` drift.
- Split `git` and `gh` into separate Bash calls. Hand live prod-DB mutations to the owner via `! <cmd>`.
- Pre-PR gate: `pnpm lint`, `test:unit`, `test:integration`, `parity:routes`, `parity:styles`, `check:schema-sync`, `check:handicap-sync`.
- Commit trailer: `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`.

## Definition of done

fitbull, holding an OAuth token for a consenting handicappin user, can `POST /v1/rounds` and receive `201` with a provisional index; a replayed `externalId` returns the same round; an over-limit round returns `201` with `status: "quarantined"` and is excluded from both the count and the handicap; `GET /v1/rounds` reflects what landed; all five routes are rate-limited, error-mapped, canary-covered and security-reviewed; and the owner has closed LB-3 before fitbull is publicly released.
