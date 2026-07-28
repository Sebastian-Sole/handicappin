# Black Hat Review — scorecard-write-semantics

Perspective: caution and risk. Verdict: **mixed**. The broad direction (Postgres over Upstash, sync 201, reject-not-quarantine) is defensible, but the recommendation commits to several specifics whose failure modes are underexamined, and it defers as "open questions" two items that are actually correctness holes in the exact primitive being built.

## 1. The natural key (userId, teeId, teeTime) will produce both false 409s and false negatives

Verified in `apps/web/db/schema.ts`: `teeTime` is a full `timestamp` (line 238) and the round table has a `nineHoleSection` ("front" | "back", line 258).

- **False 409s**: two legitimate 9-hole rounds (front then back) on the same tee can plausibly share a teeTime when a client uses date-only precision — exactly what a fitness-app backfill of historical rounds will do (midnight default). A 36-holes-in-a-day import with date-granularity teeTimes hard-fails on the second round. The proposed index does not include the section column, so this is not hypothetical; the wire format itself carries `section`.
- **False negatives on the advertised benefit**: the cross-client dedupe story ("catches the same round entered in both apps") only works if both clients produce the *same timestamp to the second*. A fitness app recording GPS start time (10:03:47) and a human entering 10:00 do not collide. The natural-key net catches almost none of the cross-client duplicates it is being sold on, while introducing the false-409 class above. This is the worst trade: cost without the benefit.
- **Retroactive migration hazard**: the table has had zero dedupe forever; production data may already violate the index. The migration needs a duplicate audit + cleanup plan first (and the prod migration-history has already burned us once — see the phantom-applied incident on PR #161). Also, once the index exists it fires for the *web and native clients too*, which have never handled a 409/unique-violation on submission. Shipping the index without updating both clients' error paths (native under the parity rule) turns an invisible dupe into a visible raw error for existing users.

## 2. "Inside the existing db.transaction" is not actually the Stripe pattern, and it has a concurrency cost

Brandur/Stripe claim the key in a *separate, short* transaction before doing the work, precisely so the key row is a recovery point and so concurrent retries fail fast. Writing the key row inside the existing (long, ~700-line-pipeline) transaction means:

- A concurrent retry with the same key blocks on the unique-index row lock **for the full duration of the first transaction** (which includes auto-create inserts and per-hole rows on the internal path). On serverless Vercel + Supabase pooler, flaky-mobile retry storms translate into held connections — the exact clients this feature exists for are the ones that will pile up. Connection exhaustion here degrades the whole app, not just the API.
- After the blocked retry gets its unique violation, the handler must re-read the committed key row and replay — that logic (violation-catch, fingerprint compare, replay, "processing" state for the in-flight window) is what the "~80 lines" estimate hand-waves. Half-implementations of this pattern are worse than natural-key-only because they *appear* to guarantee replay and don't.
- Response replay requires persisting response bodies in Postgres: someone owns the 24h purge (another cron/edge function — the queue drainer precedent says these get built once and monitored never), and fingerprint-mismatch semantics (same key, different body) are unspecified in the recommendation.

If the team is not going to implement the full claim-row state machine, option 2 (natural-key only, corrected key) is *more* honest: clients must implement 409→GET reconciliation anyway (see §3), so the marginal value of the key table shrinks toward zero.

## 3. The 24h-expiry + 409 fallback quietly forces every client to build reconciliation anyway

The stated primary consumer queues rounds offline over flaky networks. The failure path that matters: submit succeeds, response lost, app killed, retry after key expiry → natural-key 409. So every serious client must implement "on 409, GET the round and match it to my local record" regardless. Once that logic exists, the idempotency table's replay feature only covers the <24h window — a narrow benefit purchased with a new table, a purge job, fingerprint logic, and the lock-contention risk in §2. The recommendation never confronts this substitution.

## 4. The compensating-delete race is not an open question — it invalidates the replay guarantee

`round.ts:949-992` (verified): on the free-tier race, the round is deleted *after commit*, outside the transaction. Under the proposed design the idempotency key row commits with the round, then the round is deleted, and the key survives pointing at a 201 response for a round that no longer exists. A retry then *replays a success for a deleted round* — the exact phantom-success failure the recommendation uses to reject Upstash. Listing this under "open questions" is a category error: the fix (move the limit re-check inside the transaction, or delete/poison the key in the compensation path) must ship *with* the key table, not after it.

## 5. Strict catalog-only guarantees the flagship consumer fails on day one, and the walkback will be rushed

The catalog is 207 validated courses, Norway + Scotland. The fitness app's pitch is "fill out a scorecard, it saves automatically." Any user outside those two countries — or at any of the thousands of uncatalogued courses inside them — gets a hard 422 with no recourse in-app, while the same user in the handicappin web app succeeds via auto-create. Predictable sequence: the fitness app launches, the failure rate is visible, and "just let the API auto-create pending courses" gets bolted on under deadline pressure — inheriting the name-only matching bug (`round.ts:370`), the N-pending-tees + 18-hole-rows + admin-email-per-submission amplification, and none of the deliberation happening now. Strict-reject is the right *default posture*, but shipping it without the companion course-submission endpoint (deferred to "later if ever") is not protecting the catalog; it is scheduling a panic.

Also unpriced: strict validation asymmetry means the same user's data is inconsistent by source — rounds they could log on web are rejected via API — which reads to the user as "the integration is broken," not "the catalog is curated."

## 6. Shared-schema hardening and server-derived hcpStrokes are silent web/native regressions

- Promoting `putts+penalties<=strokes-1` and `strokes>=1` into the *shared* zod schema changes the web and native contract in the same release. Any historical round edit path, or any in-field native client version predating the change, that currently submits values the UI merely discouraged will start hard-failing server-side. Native app versions can't be force-upgraded; this needs a tolerance window or read-path audit, and the parity rule makes it a two-app change.
- Server-deriving `hcpStrokes` while the web client still computes it browser-side means the net-double-bogey cap can differ by source for the same user until the parity check (flagged as an open question) is done. Shipping the API before that check risks handicap indexes that depend on *which app logged the round* — in a WHS product that is the one inconsistency you cannot have. The parity check is a prerequisite, not a follow-up.

## Worst realistic outcome

A retry storm from the fitness app serializes on in-transaction key locks and exhausts the pooler during a weekend tournament; meanwhile a free-tier race deletes a round whose idempotency key still replays 201s, the user's fitness app shows the round as saved, and their handicap index never includes it. Separately, a Scottish user's date-only backfill 409s on their second 9-hole round of the day and the fitness app team hot-patches around validation by resubmitting with jittered teeTimes — permanently polluting the natural key's meaning.

## Must-address before locking

1. Fix or in-transaction the free-tier compensating delete **in the same change** as the key table; a replayable key must never outlive its round.
2. Redefine the natural key to include the 9-hole section (or drop the cross-client-dedupe claim entirely) and specify teeTime precision/normalization for backfill; audit prod for existing violators before the unique index migration.
3. Decide explicitly: full Brandur claim-row state machine (separate claim transaction, violation-catch, replay, purge job) or natural-key-only. Reject the middle ground of "key row inside the long transaction" — it has the lock-contention cost without the recovery semantics.
4. Web + native clients must handle the new 409 and the hardened zod invariants before the index/schema ship; native needs a version-tolerance plan.
5. hcpStrokes server/browser parity check on historical rounds is a prerequisite to v1, not an open question.
6. Commit to a timeline (even "v1.1") for the rate-limited course-submission endpoint, or accept in writing that the fitness app will hard-fail outside the 207-course catalog.
