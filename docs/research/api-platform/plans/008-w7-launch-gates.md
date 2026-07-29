# 008 — W7: Launch gates (governance + demand instrumentation + contract doc)

**Workstream:** W7 · **Status:** DOCS LANDED 2026-07-29 — awaiting owner sign-off + implementation · **Billing-gated:** No (governance/demand independent of billing)

> **Deliverables (2026-07-29).** The doc-only parts of this subplan are written; what remains is owner judgment and the code that ships with v1.
>
> | Item | Where | State |
> |---|---|---|
> | Governance fact pattern + risk posture (blocking vs monitor) + NGF question draft | [`../GOVERNANCE.md`](../GOVERNANCE.md) | DRAFT — gate closes on owner sign-off (§7 there) |
> | Dated ADR: triggers with thresholds, 2026-10-15 review, 2027-03-31 hard re-decide | [`../ADR-2026-07-29-launch-gates.md`](../ADR-2026-07-29-launch-gates.md) | PROPOSED — thresholds need owner ratification |
> | Demand instrumentation spec (PostHog events + interest form) | [`../DEMAND_INSTRUMENTATION.md`](../DEMAND_INSTRUMENTATION.md) | SPEC — implement with v1 (no code yet) |
> | Internal `/v1` contract doc | [`005-phase0-contract.md`](005-phase0-contract.md) (005 Phase 0, PR #174) | Owned by 005 — referenced, not duplicated. C.15's requirement is that it stays **current**; the maintenance rule + CI spec-parity backstop are recorded in the ADR §5 (G3). |
>
> Nothing here is implemented: no analytics constants, no form, no route. That work rides with the v1 surface (005/006).
**Depends on:** 005 (W4) — the surface must exist to instrument and to govern. Runs in parallel with 006/007; the governance check is a hard **pre-launch** gate that must not be discovered late.
**Blocks:** prod launch.

---

## Goal

The pre-launch checks that are independent of engineering readiness: the USGA/NGF governance fact-pattern check, demand instrumentation shipping **with** v1, the internal contract doc, and a dated ADR with trigger thresholds and review dates.

## Background

The strategic decision is: private first-party seam this cycle, no platform distribution (no OAuth issuance for third parties, no developer portal, no self-serve keys, no public docs). Vetted-partner is the phase-2 shape behind falsifiable triggers; the genuine platform prize is NGF Leverandør certification (issues #147/#151), which a prematurely public unofficial-handicap API would complicate. The deferral is only safe if it is **falsifiable** — hence demand instrumentation ships with v1 as the single most-unanimous panel item (the "API access" interest form + PostHog event), because two of the three phase-2 triggers are passive and will never fire on their own.

The governance check is moved from phase 2 to **pre-launch** because the exposure begins at v1 ship, not at public docs: fitbull is itself a public app surfacing the WHS-method unofficial index (a louder version of the #151 fact pattern) regardless of API privacy. Whether to proactively raise the fitbull surfacing in the live USGA #151 / NGF #147 threads is an owner-level negotiation-posture call. And the internal `/api/v1` contract doc must actually be written and maintained — if "defer public docs" becomes "no docs," the phase-2 head start evaporates and Option B degrades into "Option A with extra steps."

## Scope

- **Governance / USGA-NGF fact-pattern check** (pre-launch blocker): answer whether a public fitbull surfacing the WHS-method unofficial index changes the live USGA #151 / NGF #147 fact pattern; document the conclusion (and whether to proactively raise it in the threads — **OWNER-level** negotiation call).
- **Demand instrumentation** ships **with** v1: an "API access" interest form + PostHog event — the only planned falsifier of the deferral.
- **Internal contract doc** actually written and maintained (overlaps 005 Phase 0's frozen contract doc — keep it current).
- **Dated ADR** with trigger thresholds + ~2026-10 review + hard re-decide by end Q1 2027 (strategy tracker, issue #144).

## Binding conditions (verbatim from golf-api-landscape §A.5, §C)

> 5. **Governance check before launch, not phase 2** (Black, Blue, pre-mortem): answer research open question 2 — does a public fitness app surfacing the WHS-method unofficial index (especially US market) change the live USGA #151 / NGF #147 fact pattern? Ask in the existing threads if ambiguous, and document the conclusion that a first-party app does or does not trip the boundary. The exposure begins at v1 ship, not at public docs.

> 12. **Ship demand instrumentation WITH v1, not later**: the "API access" interest form + PostHog event is promoted from open question to committed scope (the panel's most unanimous single item). Without it, triggers (2) and (3) are unfalsifiable and the deferral has no measured exit ramp.
> 13. **Write concrete trigger thresholds with an owner** (Black): what specifically counts as "a named partner with users asks" and what user-base level anchors trigger (3).
> 14. **Record the decision + triggers in a dated ADR / strategy-issue comment, with a calendar review (~2026-10, and a hard re-decide by end Q1 2027)** at which deferred platform work is re-funded, reshaped for NGF official rails, or killed. "Defer until trigger" must not silently become "never."
> 15. **The internal /api/v1 contract doc must actually be written and maintained** — if "defer public docs" becomes "no docs," the phase-2 head start evaporates and Option B degrades into Option A with extra steps.

Open gate (DECISIONS §Open gates): the governance check is a **pre-launch blocker** — v1 does not ship until the USGA/NGF fact-pattern question is answered.

## OWNER (judgment calls — not agent work)

- [ ] **Governance posture:** whether to proactively raise the fitbull surfacing in the USGA #151 / NGF #147 threads, and how. Negotiation-posture call only the owner can make. → recommendation + drafted NGF question in `../GOVERNANCE.md` §7.3 / §8.
- [ ] **Trigger thresholds:** what specifically counts as "a named partner with users asks" and what user-base level anchors the demand trigger. → proposed numbers with reasoning in `../ADR-2026-07-29-launch-gates.md` §3 (T2/T3), ratify or replace.
- [ ] **Unknowns the docs cannot resolve:** has NGF replied to the 2026-07-13 enquiry (and was the ~07-20 Gmail follow-up sent)? will fitbull be distributed to US users? will fitbull display the index at all? → `../GOVERNANCE.md` §5 (U1–U3). U3 is a real design lever: no index display collapses most of the exposure.

## Non-goals

- Building any platform-distribution surface (developer portal, self-serve keys, public docs) — deferred behind triggers.
- Reopening the strategic verdict (defer distribution, vetted-partner phase 2) — locked.

## Definition of done

- Governance conclusion documented before v1 ships.
- Demand form + PostHog event live at launch.
- Contract doc committed and current; dated ADR + trigger thresholds + ~2026-10 review + end-Q1-2027 re-decide recorded.

## Verification commands

```bash
pnpm lint
pnpm test:unit
```

Manual: the PostHog "API access" event fires in a smoke test; governance doc reviewed by owner; ADR committed to the strategy tracker (#144).
