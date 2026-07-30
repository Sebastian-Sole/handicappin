# ADR 2026-07-29 — Platform distribution deferred; launch gates and re-decide dates

**Date:** 2026-07-29 · **Amended:** 2026-07-30 (§5.1 added; G3/G4 status lines updated to name merged PRs — see §5.2) · **Status:** PROPOSED (owner ratification required — see §7) · **Workstream:** W7 / subplan `plans/008-w7-launch-gates.md`
**Supersedes nothing.** Records, dates, and makes falsifiable the strategy already locked in `DECISIONS.md` §8.
**Binding source:** golf-api-landscape synthesis §C.12–15; DECISIONS §8 + §Open gates.

---

## 1. Context

handicappin is shipping a private, first-party REST `/v1` surface (`api.handicappin.com`) whose only consumer is **fitbull**, the owner's separate Convex fitness app. The strategic verdict — reached by an 8-topic research pass and a 7-perspective panel, and locked in `DECISIONS.md` — is: build the contract-hygiene parts of a platform (extraction, versioning, zod, idempotency, per-consumer attribution) and **defer every distribution part** (OAuth issuance to third parties, developer portal, self-serve keys, public docs, SDKs).

Two things make that deferral safe rather than lazy, and both are this ADR's subject:

1. It must be **falsifiable** — measured triggers with numbers, not vibes (§3, and `DEMAND_INSTRUMENTATION.md`).
2. It must be **time-boxed** — calendar dates at which the deferral is re-funded, reshaped, or killed, so "defer until trigger" cannot silently become "never" (§4).

A third pre-launch gate is governance: the product computes golf handicaps by the WHS method, which the USGA/R&A claim as theirs to authorize, and fitbull would surface that number in a second public app. That fact pattern is documented in `GOVERNANCE.md`; its blocking items are restated in §5 because they gate the same launch this ADR gates.

## 2. Decision

**Defer platform distribution. Ship /v1 as a private first-party seam. Declare vetted-partner (manual, named, per-consumer credentials) as the shape of phase 2, entered only when a trigger in §3 fires or a review in §4 decides otherwise.**

Rationale, in one line each (full argument in `topics/golf-api-landscape/`):

- Every real integration in consumer golf is a bespoke named-partner deal (GHIN GPA, Garmin Golf Premium, Arccos, TheGrint Connect); **zero** self-serve surfaces exist in the category as searched 2026-07-20.
- API value here scales with the user graph, not endpoint quality — handicappin's graph cannot yet anchor partner demand.
- The genuine platform prize is **NGF Leverandør certification** (#147), and a prematurely public *unofficial*-handicap API complicates that negotiation rather than advancing it (`GOVERNANCE.md` §2.4).
- **Decision asymmetry** (the panel's structural point, recorded here deliberately): if demand is secretly large, deferral costs recoverable weeks; if it is not, building the platform costs weeks *and* governance standing during live USGA/NGF threads — partially irreversible. Deferral dominates under both demand states.

## 3. Triggers — the falsifiable exits

Any one trigger firing moves phase 2 from "deferred" to "on the table" — it opens a decision, it does not auto-fund the work. Every trigger has a measurement source; a trigger with no source is not a trigger.

| # | Trigger | Threshold (**OWNER to ratify the numbers**) | Measured by |
|---|---|---|---|
| T1 | **NGF Leverandør certification granted** (or a concrete certification path with a spec and test access) | Binary: written confirmation from NGF | Issue #147 thread |
| T2 | **A named partner with users asks** | **≥1** inbound asker that is (a) a *named* product/organization, not an individual hobby project, (b) already shipping to users — `has_users = true` / `use_case = "existing_app" \| "club_or_federation"`, and (c) willing to take a call. Recommended baseline: an asker with **≥500 users**. Two such askers in a quarter = strong signal, escalate immediately rather than waiting for a review date. | `api_access_interest_submitted` + the interest record; inbound email counts too (§Gotchas in `DEMAND_INSTRUMENTATION.md`) |
| T3 | **Own user base can anchor a partner program** | **≥2,000 users with ≥1 round logged in the trailing 90 days** (a partner program needs an active graph, not registrations). Interim checkpoint: **≥500 active** is the level at which the threshold itself should be re-argued rather than treated as gospel. | PostHog / DB; the "API platform" dashboard |
| T4 | **A first-party need the private seam can't serve** (e.g. a third owned product, or fitbull requiring scopes/permissions the v1 model lacks) | Binary, owner judgment | Engineering |

**Why numbers at all:** condition C.13 requires the owner to write concrete thresholds because unquantified triggers are unfalsifiable. The numbers above are **proposals with stated reasoning**, deliberately at the low end (this is a small product; 2,000 active is a real milestone, 500 is the "re-argue" tripwire). The owner overriding them is the point of §7 — but they must be *numbers*, not "when it feels like enough".

**Anti-trigger (explicit):** owner enthusiasm, a competitor announcement, or a slow week are not triggers. Neither is a single hobbyist request.

## 4. Review dates

| Date | Review | Outcome must be one of |
|---|---|---|
| **2026-10-15** | Calendar review (the "~2026-10" review required by C.14). Inputs: the "API platform" PostHog dashboard (§5 of `DEMAND_INSTRUMENTATION.md`), #147 state, fitbull's actual usage, `GOVERNANCE.md` AM-triggers. | (a) keep deferring with the same triggers, (b) adjust thresholds with reasons, (c) enter phase 2, (d) kill the platform ambition and delete the deferred scope from the roadmap |
| **2027-03-31** | **Hard re-decide** (end Q1 2027). Deferral cannot be renewed a third time by default: this review must either re-fund phase-2 work, reshape it for NGF official rails, or explicitly kill it. | (a) fund, (b) reshape for official rails, (c) kill — "keep deferring" is not an available answer without a new dated ADR replacing this one |

Both dates go in the owner's calendar and are referenced from the strategy tracker (issue #144). An unattended review date is the failure mode this ADR exists to prevent.

## 5. Pre-launch gates (both must close before v1 serves a *publicly released* fitbull)

- **G1 — Governance.** `GOVERNANCE.md` LB-1 (no index display to US-market users while the GPA track is open, or GPA explicitly parked), LB-2 (zero WHS marks in fitbull UI/store/marketing), LB-3 (owner sign-off on the fact pattern + the negotiation-posture call). Shipping /v1 into a private fitbull dev/TestFlight build is not gated.
- **G2 — Demand instrumentation live.** The interest form + `api_access_interest_submitted` (and the view event) shipping **with** v1, per `DEMAND_INSTRUMENTATION.md`. Condition C.12: without it, T2 and T3 are unfalsifiable.
- **G4 — PostgREST column-grant sweep.** See §5.1 for the invariant and §5.2 for what has already shipped against it. The primary control is the column-grant default; this gate is the backstop sweep, run **at launch across every PostgREST-reachable table**, confirming the invariant held. The two tables audited during this cycle (`round`, `score`) are done; the sweep itself is not, so G4 is **open**.
- **G3 — Contract doc current.** The frozen `/v1` contract lives in `plans/005-phase0-contract.md` (005 Phase 0, merged 2026-07-30 in PR #174) and is the single source of truth; OpenAPI 3.1 is generated from the shared zod schemas with a CI regen-and-diff gate (DECISIONS §5). Condition C.15's requirement is that this doc stays **current**, not that a second doc exists — so the maintenance rule is: any `/v1` shape change updates `005-phase0-contract.md` in the same PR, and the CI spec-parity gate is the mechanical backstop. This ADR does not restate the contract.

### 5.1 PostgREST hardening invariant (G4)

Added 2026-07-30 out of this cycle's security work, where the same class of hole was found behind **four different doors on two tables**. Encoded as an invariant rather than a per-column reminder, because per-column reminders are what let it recur.

> **For every server-owned column on a PostgREST-reachable table, confirm it is absent from BOTH the INSERT and the UPDATE column-grant lists.** Restrictive policies govern *values*; column grants govern *which columns a client may name at all*. A column gated on one verb is not gated on the other.

Two traps, each of which produced a wrong first answer during this cycle:

1. **Column-level revokes are no-ops while the table-level grant is held.** Postgres permits an INSERT/UPDATE if **either** the table-level **or** a column-level privilege matches, so revoking a single column while the blanket table grant stands changes nothing. Each block must `revoke <verb> on <table>` first, then re-grant per column. **Prod corollary:** that revoke also destroys the existing column grants, so revoke and re-grant must run in **one transaction** (`psql -1`) or the surface is briefly wide open — or permanently narrow if the re-grant fails.
2. **Row-local ownership checks are not relational ownership checks.** A policy of the form `WITH CHECK (auth.uid() = "userId")` proves who owns the *row*, not what the row *points at* — a client-supplied foreign key is unconstrained by it. Where a child row's ownership derives through a parent, the policy must assert that relationship with an `EXISTS` against the parent. One instance of this class was found and remediated during this cycle; the concrete case is documented in PR #176 (see §5.2).

One caveat on generalizing results: a value-axis check on a `uuid` column is safe partly *because* of the type's canonicalizing coercion. The same pattern on a `text` column is bypassable via case or whitespace variation. Do not carry a uuid-column pass over to a text column.

### 5.2 Status of the fixes (verified 2026-07-30)

Both instances found this cycle are **merged and live in production**. Named by merged PR rather than by branch, because a branch reference stops being checkable the moment the branch is deleted.

| Instance | Fix | Merged | In production |
|---|---|---|---|
| Trap 2 — child-row ownership on `score` | PR #176: restrictive `EXISTS`-against-parent policies on INSERT and UPDATE, plus a column-grant sweep on `score` | 2026-07-30 | Yes — applied 2026-07-30 |
| Trap 1 — column grants on `round` | PR #173: `supabase/migrations/20260730120000_round_natural_key_and_api_columns.sql` (renumbered from `20260729100000` so the remote history stays monotonic). Client roles hold **no INSERT** on `round` and UPDATE on `notes` alone | 2026-07-30 | Yes — applied 2026-07-30 |

**How that "in production" claim was established, because the distinction is the point of G4:** the new columns were confirmed to resolve through the live PostgREST API with a deliberately non-existent control column proving the check discriminates, and the resulting privileges were read back from `information_schema.column_privileges` on the production database. Neither a workflow log nor a row in the migration-history table was treated as proof — this database has carried a history row for DDL that never ran.

**On the withheld worked example:** the earlier omission was conditioned on the remediation being unmerged, and that condition has now lapsed. This ADR is nonetheless kept at the invariant level deliberately — the invariant is what generalizes, and the repository is public. Adding a worked example is now permissible, but it should be a deliberate choice, not a default.

## 6. Consequences

**Accepted:**
- Some discipline (versioning, idempotency, RFC 9457, spec parity) is paid before any second consumer exists. Justified because the same work is consumed by every future branch, including the NGF-official one.
- If long-tail demand turns out to be real and immediate, we are weeks late to it. Priced and accepted (§2 asymmetry).
- The surface stays marked internal/unstable, so the version stamp is not a promise (DECISIONS §5).

**Rejected and why:** Option C (build platform-grade now) — no perspective on the panel defended it; the governance downside during live USGA/NGF threads is the asymmetric one. Option A (no contract hygiene) — leaves `submitScorecard` welded to tRPC and forfeits cheap option value.

**Cost of being wrong in the "kill" direction:** if 2027-03-31 kills the ambition, the retained assets (extracted service, versioned surface, OpenAPI) are still load-bearing for fitbull and for any NGF integration. Nothing built under this ADR is wasted by a kill decision — which is itself part of why deferral is cheap.

## 7. Owner ratification checklist

This ADR is **PROPOSED** until these are done; change Status to LOCKED (dated) when they are.

1. [ ] Ratify or replace the T2 threshold (named partner + `≥500 users` baseline).
2. [ ] Ratify or replace the T3 threshold (`≥2,000` active users, `≥500` re-argue tripwire).
3. [ ] Put **2026-10-15** and **2027-03-31** in the calendar; link this ADR from issue #144.
4. [ ] Sign off `GOVERNANCE.md` §7 (including the negotiation-posture call and the NGF question in §8 there).
5. [ ] Create the "API platform" PostHog dashboard (three insights, `DEMAND_INSTRUMENTATION.md` §5) so the October review has something to read.

## 8. References

- `DECISIONS.md` §8 (locked strategy), §Open gates (this governance gate)
- `topics/golf-api-landscape/research.md` + `synthesis.md` (2026-07-20) — landscape evidence and conditions C.12–15
- `GOVERNANCE.md` (2026-07-29) — WHS/USGA/NGF fact pattern, blocking vs monitor risks, NGF question draft
- `DEMAND_INSTRUMENTATION.md` (2026-07-29) — event taxonomy, form spec, dashboard
- `plans/005-phase0-contract.md` (merged 2026-07-30, PR #174) — the frozen `/v1` contract, source of truth for G3
- Issues #144 (strategy tracker), #147 (NGF Leverandør), #151 (USGA GPA), #148 (ladder/claims grilling)
