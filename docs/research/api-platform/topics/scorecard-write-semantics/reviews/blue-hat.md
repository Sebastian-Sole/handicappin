# Blue Hat review — scorecard-write-semantics

Reviewer stance: process control. Was this the right question, was the method sound, and what should the decision process be before locking?

Verdict: **agree**, with process conditions.

## 1. Was the right question answered?

Mostly — and notably, the research *improved* the question before answering it. Two premises baked into the decision prompt ("the transactional handicap recalc" needs sync-vs-202 treatment; quarantine is a hypothetical option) were checked against code and found false: the recalc is already async (trigger → `handicap_calculation_queue` → cron edge function), and pending-round quarantine is shipped semantics. Overturning a question's premises via primary evidence before choosing among its options is exactly the process we want. The sync-vs-202 "decision" thereby collapsed to a near-tautology, which the research honestly reports rather than dressing up as a hard call.

One framing drift to flag: the recommendation quietly expands scope from "public endpoint semantics" to **changing the web client's trust model** (promote putts/penalties and `strokes>=1` into the shared zod schema; server-derive `hcpStrokes`, unifying web onto it). That may well be right, but it is a different decision with different blast radius — existing rounds and the web edit path may violate the newly promoted invariants, and no compatibility check against historical data was run. It should be tracked as its own decision, not ride along inside the API contract lock.

## 2. Method soundness

**Codebase grounding: strong.** Claims are cited file:line, pinned to `main @ d06c827`, and I spot-checked three load-bearing ones — round table has no unique constraint beyond the PK (`apps/web/db/schema.ts:264` area), name-only course match (`round.ts:373`), approved-only queue filter (`process-handicap-queue/index.ts:192`). All held. This is the strongest part of the work: the recommendation's two hard pillars (zero dedupe exists; recalc already async) are directly verifiable facts, not judgment.

**External sources: adequate with one soft spot.** Stripe/Brandur/Strava/Garmin/Terra are primary docs, recency-stamped (July 2026), and the IETF draft status (expired Apr 2026, name still de-facto) is exactly the kind of standards-hygiene check that is usually skipped. The soft spot: **GHIN**, the single most decision-relevant domain analogue, is secondary-source only (partner docs gated), yet "the domain authority pre-validates and rejects" does real argumentative work in rejecting C3 (accept-with-flag). The file flags this honestly, but the review record should note that if GHIN's actual behavior differs (e.g., it accepts and later invalidates), the C3 rejection loses its strongest domain-norm support — though the operational arguments against C3 (junk with no cleanup owner, silent-failure clients) stand on their own.

**Options analysis: genuine.** Four options with real cons each, and the rejected ones are rejected for reasons grounded in this codebase (Upstash non-atomicity; 202 hiding a milliseconds transaction), not generic taste. The A1+A2 composition (belt and suspenders across different duplicate classes) is a better answer than the question's either/or framing offered.

## 3. Process gaps that must be closed before locking

1. **No existing-data check for the natural-key migration.** The pipeline has had zero dedupe forever; duplicates on `(userId, teeId, teeTime)` may already exist in prod. The unique-index migration will fail or silently require a cleanup pass. Run the duplicate query against prod (via the session pooler, per the known IPv6 gotcha) *before* committing to the 409 contract. This is a 5-minute check the research skipped.
2. **The main cost of C1 is a product question the research can't settle.** Catalog-only v1 is presented at medium-high engineering confidence, but its real risk is coverage: 207 validated courses (Norway + Scotland) vs where consumer #1's users actually play. If the fitness app's users routinely hit uncataloged courses, C1's "deep-link to web add-course flow" mitigation becomes the primary UX, and the separate course-submission endpoint moves from "later if ever" to v1-adjacent. The owner should sign off on this tradeoff with expected-usage data, not inherit it as an engineering default.
3. **Web-path hardening is a separate decision** (see §1): needs a historical-data audit (do existing rounds violate `putts+pen<=strokes-1` or `strokes>=1`?) and the `addHcpStrokesToScores`-vs-browser parity check the research itself lists as open question 4. Don't let the API lock silently commit the web app to schema changes.
4. **Retention window (24h vs 7d) should be decided with consumer #1's offline behavior in hand**, since it's in-house — this is answerable by asking, not by defaulting to Stripe's number.

## 4. What would change the answer

- Existing prod duplicates on the natural key → migration plan changes, possibly the key choice too (open question 5).
- Consumer #1 usage data showing heavy uncataloged-course play → C1 must ship alongside a course-submission path, weakening "catalog-only v1" as stated.
- Primary GHIN docs contradicting the pre-validate/reject characterization → C3 rejection rests on operational arguments alone (still sufficient, but the write-up should be corrected).
- None of these plausibly flip (a) A1+A2-in-Postgres or (b) sync-201 — those are overdetermined by the codebase facts.

## 5. Recommended decision process

Split the lock into three tickets: (i) **API write contract** (idempotency + natural key + sync 201 + wire format) — decidable now, pending the prod duplicate check; (ii) **catalog-only vs course-submission-in-v1** — product decision, needs owner + consumer-#1 usage input; (iii) **shared-schema/web hardening** — engineering decision with its own data audit and parity test. Locking all three as one bundle is how the ride-along scope in §1 sneaks past review.
