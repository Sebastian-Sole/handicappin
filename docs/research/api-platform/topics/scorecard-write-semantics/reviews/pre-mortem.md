# Pre-mortem review: scorecard-write-semantics

Perspective: it is January 2027. The fitness-app integration shipped on this recommendation in August 2026 and has badly underdelivered. This is the incident narrative, traced back to the recommendation, followed by the preconditions that would have prevented it.

Verdict: **mixed**. The idempotency mechanics (Postgres key table in-transaction, no Upstash, sync 201) survived the six months untouched — they were right. The failures came from the two places the recommendation was most confident: strict catalog-only v1, and the natural-key unique index applied to a live table whose data semantics were never audited.

---

## What went wrong (January 2027 retrospective)

### Failure 1 — Catalog-only v1 starved the only consumer (the big one)

The recommendation locked `POST /v1/rounds` to "approved non-archived tee required, NO auto-create on the wire" to protect the 207-course validated catalog. But 207 courses is Norway plus Scotland pilot coverage. The fitness app's users — the entire point of the integration — played wherever they play. From the first week, the dominant API response was `422 course_not_found`. The fitness app had no recourse: the "separate rate-limited course-submission endpoint later if ever needed" was deferred exactly the way 'later' features always are — it was never built, because the API had no traction, because the API rejected most rounds, because the course endpoint didn't exist. A perfect deadlock.

By October the fitness app dev (i.e., the same owner wearing the other hat) quietly stopped promoting the integration. The web client could still auto-create pending courses; the API consumer was a second-class citizen of its own platform. The research's own domain analogy was misapplied: GHIN is catalog-only because GHIN's catalog is *complete for its jurisdiction*. Handicappin's catalog covers a sliver of two countries. Strict-reject is the right end state and the wrong v1 unless coverage or an escape hatch ships with it.

What the recommendation should have demanded: a coverage measurement (what fraction of the fitness app's expected rounds land on the 207 courses?) before choosing strict-reject, and a bundled answer for the miss case — either the course-submission endpoint in the same milestone, or an explicit "round saved without handicap effect, pending course match" degraded mode that reuses the existing pending-quarantine the research itself found.

### Failure 2 — The (userId, teeId, teeTime) unique index shipped against unaudited data and unpinned semantics

The migration adding the natural-key index was written against an assumption, not an audit. Two things bit:

- `teeTime` is `timestamp().notNull()` (db/schema.ts:238) and the web client defaults it to `roundToNearestMinute(new Date())` (golf-scorecard.tsx:143), user-editable. Minute-granularity wall-clock from the browser. But the fitness app's historical-import flow (the marquee use case in the open questions: "how far back historical backfill is allowed") only had *dates* for old rounds. It normalized them to midnight. Two nine-hole rounds on the same course on the same day — a completely ordinary golf pattern — collided on the unique index and the second one 409'd as `duplicate_round`. Users saw "duplicate" errors on rounds that were not duplicates, which is a worse trust failure than silent duplication, because the error asserts the user is wrong.
- The index also governs the WEB write path (a DB constraint cannot be API-only). Nobody checked prod for existing collisions before the migration; it failed to apply on prod the same way the phantom-applied Ballerud migration saga went (memory: prod history lies; verify with a dump). A week of migration-history repair followed.

### Failure 3 — The stranded-key ghost, flagged and shipped anyway

The recommendation's own open question — "should the post-commit compensating-delete race path (round.ts:949) move inside the transaction now that a dedupe primitive exists (it can strand a key pointing at a deleted round)" — was left open, and open questions do not block launches. The exact scenario shipped: free-tier user, concurrent submissions over flaky mobile (the precise population idempotency was built for), transaction commits, idempotency key commits with it, the post-commit re-check deletes the round (round.ts:949-992), then the client retries with the same key and gets a **replayed 201 for a round that no longer exists**. The fitness app showed a saved round; handicappin had nothing. These ghost-round tickets were individually small and collectively the most corrosive support pattern of the fall, because they looked like data loss. The compensating-delete path was fragile before; adding response replay on top of it upgraded it from "fragile" to "actively lies to clients."

### Failure 4 (near-miss) — Shared-schema hardening broke a web flow nobody re-tested

Promoting `strokes>=1` and putts+penalties<=strokes-1 into the *shared* zod schema "hardened web for free" — and also changed web behavior for free. The live-round flow (PR #135, local-first RoundSession) syncs partial state where unplayed holes exist as zero-stroke placeholders. The shared schema rejected a sync payload shape that had worked for a year. Caught in staging only because someone happened to run a live round that week. "For free" changes to shared validation are never free; they are unpriced.

### Background condition that nearly made all of it moot

The Cloudflare/Vercel challenge mode (429 HTML on cookie-less requests) is a known prod gotcha not mentioned anywhere in this recommendation. The endpoint semantics debated here are unreachable by any non-browser client until dashboard bypass rules exist. In the failure timeline, launch week was spent debugging "Unexpected token '<'" from the fitness app before anyone re-read the memory note. Not this topic's job to fix, but this topic's job to list as a launch precondition — write semantics for an endpoint no external client can reach is decor.

---

## What held up

For fairness in the post-incident review: Postgres-in-transaction idempotency over Upstash was correct and the phantom-success argument was validated in practice (option 3 would have produced exactly the Failure-3 class of bug on every crash, not just the free-tier race). Sync 201 with `handicapRevision: "pending"` was correct — nobody ever asked for the 202 resource, and the discovery that the recalc was already async killed option 4 dead. Server-derived hcpStrokes was correct in direction; it just needed the historical parity check to run before launch, not sit in the open-questions list.

---

## Preconditions to avoid this future

1. **Solve the catalog-miss case in the same milestone as strict-reject, informed by a coverage measurement.** Before locking (c), measure what share of the first consumer's realistic rounds resolve to an approved tee in the current catalog. If it is not >80%, v1 must ship with one of: the course-submission endpoint, or a degraded "round recorded, excluded from handicap until course matched" mode built on the existing approvalStatus quarantine. A deferred escape hatch is a decision to fail the launch consumer.

2. **Audit before indexing: prod data collision scan + pinned teeTime semantics.** Run the (userId, teeId, teeTime) duplicate scan against a prod dump (not migration history) before writing the migration, and pin the contract for teeTime granularity/timezone/date-only backfill — including the two-nine-hole-rounds-same-day case — before the unique index makes those semantics load-bearing for both API and web writes.

3. **Close, don't carry, the stranded-key question: move the free-tier re-check inside the transaction (or make the limit check transactional via a count-in-transaction) before enabling response replay.** Response replay plus post-commit compensating deletes is a machine for confirming writes that didn't survive. This is a blocker, not an open question.

4. (Smaller, but cheap) Any invariant promoted into the shared zod schema gets an explicit regression pass over the live-round/partial-state flows before merge, and the Cloudflare bypass rule goes on the launch checklist for this endpoint by name.
