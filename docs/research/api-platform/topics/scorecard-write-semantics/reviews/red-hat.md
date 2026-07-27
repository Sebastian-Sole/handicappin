# Red Hat review — scorecard-write-semantics

Perspective: gut feeling, engineer/founder instinct. Verdict: **mixed** (the mechanics feel right; one part of the picture smells naive).

## What feels right

**Sync 201 — instant yes.** The moment the research discovered the recalc is *already* async behind the queue, the 202 option died. Building an upload-status resource, a worker, and polling into every consumer to hide a millisecond transaction is Strava cosplay. The `handicapRevision: "pending"` signal is the honest, cheap version of the same promise. No hesitation here.

**The natural-key unique index is the "fix this regardless" instinct.** A round ledger with zero unique constraints, guarded by post-commit compensating deletes (`round.ts:949-992`), makes the hair on my neck stand up independently of any API work. That index protects the web client, the native client, and every future write path. If only one thing from this research ships, it should be that migration.

**Rejecting Upstash for idempotency state.** Correct smell: replay state that must be exactly as durable as the row it describes belongs in the same transaction as that row. Anyone who has debugged a Redis-committed/Postgres-rolled-back split-brain never wants to again.

**No auto-create from the API.** One buggy client loop = hundreds of junk pending courses + an email flood into the admin queue that guards a hand-cleaned catalog. Keeping free-text course creation off the public wire is the seasoned move, and GHIN doing catalog-only is the domain telling you the same thing.

## What smells

**1. The catalog-only strict-reject vs. the actual first consumer — this is the naive spot.** The catalog is ~207 validated courses, Norway + Scotland. The first consumer is a fitness app whose users play golf *wherever they play golf*. My gut says a very large fraction of real submissions from that app hit `422 course_not_found` on day one, and the mitigation on offer is "deep-link to the web add-course flow" — i.e., eject the user from the fitness app mid-flow into a different product's form, then come back and resubmit. That is not a mitigation, that is the integration's core loop breaking. The recommendation protects the catalog absolutely and I agree with protecting it — but the research treats the uncataloged-course case as a con-list footnote when it is plausibly the *majority* case for consumer #1. Something concrete has to exist for it at launch: the deferred `POST /v1/course-submissions`, a "round pending course match" holding state, or an honest product decision that the fitness app only supports cataloged courses. Pick one *before* locking the contract, not "later if ever needed."

**2. Full Stripe cosplay for one in-house consumer smells slightly rich.** Claim rows, request fingerprints, response-body replay, retention purges — for an API whose only caller is the same developer's other app. My gut says the natural-key 409 alone covers ~95% of real retry pain for structured scorecards (retries carry the same teeTime), and A2 is one migration versus A1's table + ~80 lines + new failure modes (`request_in_flight`, fingerprint mismatch, expired-key ambiguity). That said, the smell is mild: the pattern is well-worn, it is atomic, and retrofitting idempotency after third parties integrate is far worse than carrying it early. I'd accept A1+A2 as specced — but I'd also not blink if v1 shipped A2-only with the `Idempotency-Key` header *reserved* in the contract. What I would push back on is treating A1 as load-bearing for launch.

**3. New dedupe machinery next to the old compensating-delete landmine.** The free-tier over-limit path deletes the round *after* commit. Now a committed idempotency key can point at a deleted round and replay a 201 for a round that no longer exists. The research flags this as an open question; my gut says it isn't open — you cannot ship a replay-a-success mechanism alongside a delete-a-success mechanism. The limit check moves inside the transaction, or the key row is cleaned up in the same breath as the compensating delete. This must be resolved in the plan, not discovered in prod.

**4. "Hardening web for free" — quiet skepticism.** Promoting `putts+penalties <= strokes-1` and `strokes >= 1` into the shared zod schema is right in principle, but "free" hardening of a schema that live clients and historical edit flows already use is rarely free. If any existing stored round violates these (data entered before the UI rule existed), edits to it start failing validation. Small check, cheap to run, cheaper than a support ticket.

**5. Server-deriving hcpStrokes — right call, do the parity check.** Ignoring a client-supplied value that feeds the net-double-bogey cap is obviously correct. The open question about verifying `addHcpStrokesToScores` reproduces browser-computed values on historical rounds is exactly the right paranoia — silent divergence there would rewrite differentials.

## Overall

The idempotency/sync/validation mechanics read like someone who has been burned before, and I trust them. The strategic gap is that the strictness story was designed to protect the database and only afterwards asked whether the endpoint remains usable by the one app it exists for. Resolve the uncataloged-course path and the free-tier delete interaction, and this is a lock.
