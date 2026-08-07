# 000 — API Platform Subplans: Index & Dispatch Order

**Date:** 2026-07-27 · **Source:** `MASTER_PLAN.md` (W0–W7), `DECISIONS.md` (locked ADR incl. the closed billing gate + resolved ingress incident), `INGRESS_RUNBOOK.md`, and the eight `topics/*/synthesis.md`.
**Repo conventions:** `.claude/rules/coding-conventions.md`, `.claude/rules/web-native-parity.md`.

Each subplan is self-contained for an implementing agent with no other context. The master plan's three cross-cutting **checkpoints** are folded in, not given their own files: Checkpoint A (contract-design gate) is **Phase 0 of 005**; Checkpoint B (one migration) **is** 003; Checkpoint C (billing gate) is **CLOSED** and its resolution is threaded through 002/003/005.

## Subplans

| # | File | Workstream | One-line scope |
|---|------|-----------|----------------|
| 001 | `001-w0-ingress-completion.md` | W0 | Finish the ingress incident; grey-cloud `api.handicappin.com`; make `rate-limit.ts` fail-closed on the public path; host-guard negative tests; document firewall state + rollback rule. |
| 002 | `002-w1-scorecard-extraction.md` | W1 | Characterization tests first, then extract `submitScorecard` to a framework-free `server/services/scorecard/` service with an ESLint import boundary; replace the delete-on-race with an in-transaction **accept-and-quarantine** limit check. |
| 003 | `003-w3-bundled-migration.md` | W3 | One migration (after a prod duplicate scan): natural-key unique index + `externalId` UNIQUE + `submitted_via` + `updated_at` + **`quarantined`**; exclude quarantined rounds from count + handicap. |
| 004 | `004-w2-oauth-and-connect.md` | W2 | Timeboxed Supabase OAuth 2.1 spike (verbatim pass/fail criteria), then build the Connect flow, mandatory RLS `client_id` deny-policies, and the scope-claim token hook. |
| 005 | `005-w4-v1-contract-and-handlers.md` | W4 | Contract-design gate (Phase 0), then the `/v1` REST surface: shared zod, OpenAPI 3.1 + CI parity, RFC 9457 error mapper, per-principal rate limiting; billing error contract reflects **quarantine (201 + status, not 403)**. |
| 006 | `006-w5-sync-contract.md` | W5 | Polling as the v1 sync contract; measure real recalc latency; evaluate the queue-kick; recalc-pending vs failed; optional non-contractual pg_net→Convex webhook; billing-column exposure decision. |
| 007 | `007-w6-fitbull-integration-notes.md` | W6 | Handoff doc for the separate Convex repo: base URL `api.handicappin.com`, auth, day-1 calls, idempotency, polling, quarantine-status handling. |
| 008 | `008-w7-launch-gates.md` | W7 | Pre-launch governance (USGA/NGF fact pattern), demand instrumentation with v1, internal contract doc, dated ADR + review dates. |
| 009 | `009-oauth-detect-and-revoke.md` | W2 fast-follow | Detective control from the updateUser sign-off (2026-07-29): pg_cron auto-revoke of OAuth grants on password/email-change signals (`user_updated_password` audit action + `auth.users` email snapshot-compare) + daily GH-Actions watchdog on the two secure-change auth toggles. Own PR; NOT a launch blocker. |
| 010 | `010-v1-implementation.md` | **Master sequence** | **START HERE.** Executes owner decisions D1–D9 (2026-08-05): 12 parallel wave-1 tasks, then the five day-one `/v1` routes. Supersedes the dispatch order below for all remaining work. |

## Dependency graph

```
001 (W0 ingress + host) ──┐
                          ├─► 004 (W2 auth spike → build) ──┐
002 (W1 extraction) ◄────co-design────► 003 (W3 migration) ─┤
        │  (Part B quarantine wiring lands behind 003's column)  │
prod dup scan ──► 003 ────────────────────────────────────┼─► 005 (W4 /v1 + Phase 0 contract gate) ─► 006 (W5 sync)
                                                           │            │
                                                           │            ├─► 007 (W6 fitbull notes)
                                                           └────────────┴─► 008 (W7 launch gates)
```

**Critical path:** `001 (cookie-less host) → 004 (spike pass) → 005 Phase 0 (contract gate) → 005 (POST /rounds) → 008 (governance) → launch`.

002 and 003 run in parallel with 004 but both also feed 005, so the longest chain is whichever of {004, (002+003 co-design)} finishes last before 005's Phase 0. 004's spike is the sharpest risk (a 2-day timebox that can degenerate into beta archaeology). 006/007 trail 005; 008's governance check is a hard pre-launch gate that runs in parallel with 005 and must not be discovered late.

## Current status

**Updated 2026-08-05.** Nine owner decisions (D1–D9) are locked in `DECISIONS.md`; the implementation sequence now lives in **`010-v1-implementation.md`** — read that for what happens next, not the dispatch order below (which is retained as the historical plan). 010's wave-1 work is **in flight** as PRs #180–#188 (all open at the time of this update — none merged; do not treat the tasks they carry as landed).

| Workstream | Status |
|---|---|
| W0 (001) | **PARTIAL** — challenge flipped to Log; canary merged (PR #162); `api.handicappin.com` LIVE 2026-07-29; Stripe live audit done. Remaining OWNER items only: Vercel spend alerts, one WAF rate rule. |
| W1 (002) | **PART A MERGED** — service extracted to `server/services/scorecard/`. **Part B (accept-and-quarantine) NOT built** — `submit-scorecard.ts:281` still throws. Now task T1 in 010. |
| W2 (004) | **MERGED** — OAuth consent flow live in production (`app/oauth/consent/page.tsx`). One change pending: gate it on plan selection (D3 → task T5 in 010). |
| W3 (003) | **MERGED + APPLIED TO PROD** (PR #173) — migration `20260730120000`, plus column-grant hardening `20260730090000`. |
| W4 (005) | **PHASE 0 MERGED** (PR #174) — contract frozen; all four owner sign-off items closed 2026-08-05. **No `/v1` route exists yet.** Day-one surface reduced to five endpoints per D9 → task T13 in 010. |
| W5 (006) | **OFF THE CRITICAL PATH** (D9) — fitbull does not display the index, so there is no staleness problem to solve at launch. The contract still reserves the `handicapRevision` enum; 006 wires it if something ever displays an index. |
| W6 (007) | PENDING — task T14 in 010; must carry the LB-1/LB-2 obligations and the polling-cadence ceiling. |
| W7 (008) | **MERGED** (PR #175). G1 substantially closed by D7/D8; **G2 descoped to server events only** (D9 — no interest form); G3 and G4 still open. |
| W2 fast-follow (009) | **BUILT — PR open** (task T9 in 010). Migration `20260807100000_detect_and_revoke_oauth_grants.sql` (every-minute pg_cron detective control: `user_updated_password` audit scan + `auth.users` email snapshot-compare → SQL replica of `revokeGrant` + Slack alert) and `.github/workflows/auth-toggle-watchdog.yml` (daily Management-API read of the two secure-change toggles, false-vs-null branched). Integration test incl. revert-the-fix + both no-self-trigger criteria green (9/9). Blocks nothing. OWNER: `alerting_slack_webhook` Vault secret, `SUPABASE_MGMT_PAT` repo secret, prod migration apply, cron/watchdog verify. |

## Dispatch order (historical — superseded by 010)

**Superseded 2026-08-05.** M0–M2 below are complete except the noted owner items and 002 Part B (see the status table); the remaining sequence — wave-1 tasks, then the five `/v1` routes, then the trailing docs — lives in **`010-v1-implementation.md`**. Retained for the record:

1. **M0 — Incident:** finish **001**. — DONE: code items merged (PRs #162, #164, #170); OWNER dashboard items remain.
2. **M1 — Foundations (parallel, after 001's canary):**
   - **004** — the OAuth spike (hard 2-day gate; record pass/fail). — DONE: merged (PR #167).
   - **003** — the prod duplicate scan (OWNER), then the bundled migration. — DONE: merged + applied to prod (PR #173).
   - **002** — characterization tests + behavior-preserving extraction (**Part A**, no schema dep, merges immediately); **Part B** (accept-and-quarantine) lands behind 003's `quarantined` column. — Part A MERGED (PR #165); Part B is 010's T1, in flight.
3. **M2 — Contract-design gate:** **005 Phase 0** (one session; freezes error envelope, idempotency, rate-limit principal, versioning, eventual-consistency + quarantine-status statements). — DONE: merged (PR #174), sign-offs closed 2026-08-05.
4. **M3 — /v1 build:** **005** route-by-route, each with rate limit + error mapping + spec parity + canary. → now 010's T13 (five endpoints per D9).
5. **M4 — Sync + integration:** **006** (polling contract, queue-kick decision), then **007** (fitbull notes). → 006 is off the critical path (D9); 007 is 010's T14.
6. **M5 — Launch gates:** **008** (governance documented — pre-launch blocker; demand instrumentation live; contract doc + dated ADR). Then prod launch. — doc MERGED (PR #175); open gates G2–G4 are 010's T12/T6 and owner items.

## Conflicts found between the master plan and the closed billing gate (and how resolved)

The master plan (`MASTER_PLAN.md`, dated 2026-07-22) was written **before** the billing gate closed (2026-07-27). Its Checkpoint C and §3 treat billing as OPEN. Resolutions applied across the subplans:

1. **Over-limit behavior — reject vs quarantine (W1/002, W4/005).** The master plan frames W1's in-transaction check as "an over-limit round is never inserted rather than inserted-then-deleted" (i.e. reject), and W4 §333-337 holds the "over-limit route behavior" as billing-gate-blocked. **Closed gate:** over-limit = **accept-and-quarantine** — the round is stored, excluded from handicap/counts, unlocked on upgrade; the in-transaction check decides **active-vs-quarantined**; the delete-on-race is **deleted, not replaced with a reject**. Resolved: 002 implements accept-and-quarantine (with a `"reject"` policy retained only for the web/native path, whose behavior change is the separate open web-hardening gate); 005's `POST /rounds` passes `"quarantine"` and returns a **201 with a distinguishable status**, never a 403.

2. **Billing error contract (W4/005).** The master plan holds `plan_required` / `round_limit_reached` RFC 9457 codes as billing-gate-blocked. **Closed gate:** a quarantined round is a **201 with a status, not an error**, so `round_limit_reached` is no longer a 403 for over-limit rounds — it is the quarantined status on a successful write. `plan_required` (account not provisioned) remains a real error. Resolved in 005's error-mapper scope and DoD.

3. **Quarantine needs a schema column — where does it live? (W3/003 vs W1/002).** The master plan's one-migration bundle (DECISIONS #9) lists four columns and predates the quarantine decision. The round table has no field expressing "counts toward handicap/limit" vs "quarantined" (`approvalStatus` is course-data moderation, a different axis, and must not be overloaded). **Resolution (explicit ordering decision):** add a fifth column, **`quarantined`**, to **003's bundled migration** (preserving the one-migration principle), and land **002's accept-and-quarantine wiring behind 003**. 002's behavior-preserving extraction (Part A) has no schema dependency and merges first, so W1 still satisfies its "merge-blocking precondition for /v1" role immediately; only the quarantine wiring (Part B) waits on the column. The counting sites (`utils/billing/access-control.ts:39-51`) and the handicap timeline are updated in 003 to exclude `quarantined = true`.

4. **Cross-product pricing / provisioning (W2/004).** The master plan leaves cross-product pricing open (billing gate c). **Closed gate:** cross-product pricing is **deferred** — v1 linkage simply requires a handicappin account (free tier is the on-ramp); no bundles/discounts/shared entitlements. Resolved: 004 decides only the provisioning *attachment point* (the invariant is locked); there is no cross-product pricing to design. `POST /v1/profile/provision` remains the auth-independent fallback (005).

5. **The "OPEN BILLING GATE" section itself (MASTER_PLAN §3, Checkpoint C).** Its "do not invent billing decisions / blocked until the gate closes" framing is **superseded** — the gate is closed. The items it listed as blocked (billing error contract, over-limit route behavior, provisioning details, free-tier warning thresholds) are now unblocked and specified per the resolutions above; the free tier stays lifetime-25 unchanged (revisit with real volume).

6. **Ingress W0 already partially done (MASTER_PLAN W0).** The master plan lists the full W0 as pending. The ingress incident is **RESOLVED** and several items are done (challenge → Log, canary PR #162 green, Stripe live audit complete). Resolved: 001 scopes only the **remaining** items (fail-closed rate limiter, host-guard tests, docs; OWNER: spend alerts, `api.` CNAME + domain, WAF rate rule, RevenueCat check, Stripe resends) and marks the workstream PARTIAL.

No other infeasibilities were found; the three-way platform-bet fork and the superseded-wording items (bypass-rule scoping → grey-cloud host; write-only-by-default → third-party-only) were already resolved in DECISIONS and are followed as-is.
