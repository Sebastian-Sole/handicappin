# Green Hat review — scorecard-write-semantics

Perspective: creativity and alternatives. Verdict: **mixed** — sync 201 and strict-reject validation are right and I won't relitigate them; but the idempotency recommendation skipped a simpler middle option, and catalog-only v1 has an unexamined escape valve.

## 1. The option not on the list: externalId AS the idempotency mechanism

The research demotes `externalId` to "just a handle, not a uniqueness mechanism" — and then builds a Stripe-grade key table (claim row, request fingerprint, response snapshot, 24h retention, purge cron, ~80 lines) next to it. But a `UNIQUE (userId, externalId)` index IS the Garmin/Terra idempotency mechanism, and it dominates the key table on several axes for this specific v1:

- **No expiry.** The research's own open question — "offline-queueing mobile clients whose retries may outlive the 24h key" — simply disappears. externalId dedupe is permanent.
- **No new table, no retention cron.** One column + one index on `round`.
- **Response replay is a payments-shaped need, not a rounds-shaped need.** Stripe stores responses because a charge outcome is not re-derivable by GET. A round is a plain retrievable resource: on conflict, look up the existing round by externalId and return it. Replay-by-lookup gives the same client-visible determinism as replay-by-snapshot, minus the stored-body machinery. (Stored *failure* replay is the one thing lost — and for a strict-validation endpoint, re-validating a retried bad request yields the same 422 anyway, since validation is deterministic over the fingerprinted body.)
- **Reframe available:** `PUT /v1/rounds/{externalId}` makes idempotency an HTTP-semantics property. No header, no draft-that-expired-without-becoming-an-RFC, and the "same key, different body" question becomes ordinary PUT semantics.

This isn't "Upstash bad, therefore Stripe table" — there was a third store all along: **the round row itself**. The A1 key table earns its keep when genuine third parties with unknown client quality arrive; for consumer #1 (in-house, controls the client, can be told "send a UUID externalId") it is plausibly gold plating. A staged path — natural-key index + unique externalId now, Idempotency-Key header added later *without breaking anything* — was not weighed as an option.

## 2. Conflict responses: 409 is not the only creative choice

Terra's semantics for a re-delivered summary_id is "update the previous entry"; Stripe's is "replay the success". Both are friendlier to dumb retry loops than 409. Returning **200 with the existing round** when externalId (or the natural key, same fingerprint) matches turns every retry into a success from the client's point of view — which is exactly what a flaky-network mobile client wants. Reserve 409/422 for the genuinely ambiguous case: same key, *different* body. The recommendation's open question "should 409 include the round body?" dissolves if the answer is "it's not a 409".

## 3. Catalog-only v1 quietly depends on an unshipped read side

Strict catalog-only only works if the fitness app can *obtain* a `courseId`/`teeId` — i.e. a public course-search/resolve endpoint must ship in the same v1. The research references "the existing course-search endpoints" in passing but never puts them in scope. Must be made explicit or v1 is unusable by its only consumer.

## 4. The unconsidered reframe: unattached/manual rounds

The con of catalog-only ("user at an uncataloged course cannot submit") was accepted with a deep-link mitigation. But WHS arithmetic needs only **CR, slope, par** — not a catalog row. A "manual round" wire shape (client supplies ratings, no course object, round lands with `approvalStatus: pending` in the *already-shipped* quarantine, zero catalog writes, zero admin email) is the Strava manual-activity analogue. It dissolves the uncataloged-course con without exposing auto-create or touching the 207-course catalog. Doesn't have to be v1 — but it should be on the options list, because it's cheaper than the later `POST /v1/course-submissions` idea and threatens nothing.

## 5. Free win hiding in the open questions

Once any DB-level dedupe/uniqueness exists, the fragile post-commit compensating-delete free-tier path (`round.ts:949-992`) can become an in-transaction count + abort. The research lists this as an open question; green hat says it's not optional — a stored idempotency key or externalId pointing at a compensatingly-deleted round is a *new* corruption mode the current design introduces. Whichever mechanism ships, the free-tier check moves inside the transaction with it.

## What I'm not challenging

Sync 201 (the 202 option is correctly killed — the recalc is already async), rejecting Upstash for correctness state, server-derived hcpStrokes, promoting the UI-only invariants into shared zod (hardening web for free is the best idea in the doc), and protecting the catalog from auto-create blast radius.
