# Yellow Hat Review — scorecard-write-semantics

**Verdict: AGREE (with enthusiasm).** This recommendation is unusually high-leverage: nearly every line of it either rides infrastructure that already exists or hardens the core product as a side effect. The best-case outcome is not just "a safe write endpoint" — it is a cheaper, stronger core pipeline plus a credible platform story.

## Why the recommendation works

### 1. The idempotency design gets exactly-once semantics almost for free
Writing the `api_idempotency_key` claim row *inside* the existing `db.transaction` means the hard part of the Stripe pattern — atomicity between the key and the effect — costs nothing extra. The transaction boundary already exists at `round.ts:354`; the recommendation just adds one insert to it. No new infrastructure, no second source of truth, no repair window. Rejecting Upstash here is the right call for the same reason: the value of the pattern IS the atomicity, and Postgres delivers it as a byproduct of where the code already lives. One table, one index, ~80 lines, testable in the existing real-Supabase integration harness. That is a remarkably small bill for a correctness guarantee most young APIs never get right.

### 2. The natural-key index is a gift to the whole product, not just the API
The round table currently has NO unique constraint — the research surfaced that any retry from ANY client duplicates a round today. The `(userId, teeId, teeTime)` index therefore protects the web app, the native app, the watch app, and every future write path (bulk import, sync jobs) simultaneously. It also catches the cross-client duplicate (same round entered in both the fitness app and handicappin) that no idempotency key can see. DB-enforced, so it cannot rot. This is defense-in-depth the 700-line pipeline never had, purchased with a single migration.

### 3. It converts an existing bug into a fixed one
The fragile post-commit compensating-delete on the free-tier race path (`round.ts:949-992`) exists precisely because there was no dedupe primitive. Once the idempotency table and unique index land, that repair code has a principled replacement waiting. The API work funds a reliability fix the core product needed anyway.

### 4. The shared-zod hardening subsidizes core data quality
Promoting `putts+penalties <= strokes-1`, `strokes >= 1`, and server-derived `hcpStrokes` into the shared schema means the trusted web client gets hardened *for free* — closing the client-trusted `hcpStrokes` hole that feeds the net-double-bogey cap. The API project pays for invariants the handicap engine should have had. Second-order benefit: every future consumer (watch, native, imports) inherits them automatically.

### 5. Sync 201 is the fastest path to the first integration shipping
The fitness app — the whole point of v1 — integrates with ONE HTTP call. No polling loop, no status table, no webhook receiver on day one. The research's discovery that the handicap recalc is *already* async makes 202 pure ceremony; `handicapRevision: "pending"` is an honest, minimal contract that leaves a clean upgrade path to webhooks/events later without breaking anyone. Immediate 422s also mean a buggy client learns about garbage data on the first request — the cheapest possible feedback loop for an ecosystem you want to grow.

### 6. Strict catalog-only v1 protects the moat and preserves optionality
The 207-course validated catalog is a genuine competitive asset (and the credibility basis for the NGF conversation). Catalog-only writes protect it absolutely, sidestep the name-only course-matching hazard *without* first refactoring the 700-line pipeline, and prevent auto-create amplification (N pending tees + 18 hole rows + admin email per bad submission). Crucially, nothing is torn down: the pending/approved quarantine stays as internal machinery, so a rate-limited course-submission endpoint can be added later as a pure addition, not a redesign. It also matches the domain authority's norm (GHIN is catalog-only for integrators) — a story that ages well if this becomes a real third-party platform.

## What it unlocks later
- A dedupe primitive + externalId column is the substrate for two-way sync (Garmin/Terra-style) later.
- The idempotency table generalizes to every future write endpoint (course submission, profile edits) — build once, reuse.
- Machine-readable 422 codes are the seed of real API documentation and SDK generation.

## Must-address to fully capture the value
1. **Close the loop on `round.ts:949`** — decide in this design (not later) whether the compensating-delete moves inside the transaction, because a stranded idempotency key pointing at a deleted round would erode the exactly-once guarantee the whole design is buying.
2. **hcpStrokes parity check before flipping web to server derivation** — the "hardening for free" claim depends on `addHcpStrokesToScores` reproducing browser-computed values on historical rounds; verify on real data first.
3. **teeTime backfill window sized for the headline use case** — the fitness-app import of *old* rounds is a first-order benefit; an over-tight sanity window would quietly kill it.
