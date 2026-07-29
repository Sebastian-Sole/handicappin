# Scorecard write semantics: idempotency, sync/async, and validation strictness for external submissions

Research date: 2026-07-20. Topic: what the public round-submission endpoint commits to when external clients (first consumer: the developer's own fitness app) submit scorecards.

## TL;DR

1. **Idempotency**: require a Stripe-style `Idempotency-Key` header backed by a Postgres key table written **inside the existing `db.transaction` boundary**, plus a unique natural-key index on `(userId, teeId, teeTime)` as a second net. Upstash is the wrong store for this (not atomic with the round insert).
2. **Sync vs async**: return **201 synchronously**. The expensive part — full handicap-timeline recalculation — is *already asynchronous* in this codebase (Postgres queue + cron-driven edge function). Do not build a Strava-style 202/poll upload resource for structured JSON.
3. **Validation**: v1 is **strict-reject, catalog-only** — approved `courseId`+`teeId` required, no auto-create of pending courses/tees from the API, machine-readable 422s, and server-side derivation of everything the web client currently computes in the browser (`hcpStrokes`, `approvalStatus`, putts/penalty budget). The quarantine mechanism ("pending" rounds excluded from the handicap calc) **already exists** and remains the fallback if course submission is ever exposed to API consumers.

---

## 1. Ground truth from the codebase

All paths relative to the repo root.

### 1.1 The submission pipeline has zero dedupe

- `round.submitScorecard` (`apps/web/server/api/routers/round.ts:303-1037`) wraps course/tee resolution, auto-creation, round + score inserts, and submission-audit rows in one `db.transaction` (`round.ts:354`).
- The `round` table (`apps/web/db/schema.ts:231`) has **no unique constraint** other than the serial PK — only `idx_round_userId`. A retried POST after a network timeout inserts a second identical round, full stop.
- The free-tier race check (`round.ts:949-992`) is proof the team already fights concurrency by *compensating deletes after commit* — it re-counts rounds via the Supabase REST API post-transaction and manually deletes round/submissions/tees/course if over limit. This path is itself not idempotent (a crash mid-cleanup leaves orphans) and is a second reason to want a first-class dedupe primitive rather than more post-hoc repair.

### 1.2 The handicap recalculation is ALREADY async

This materially changes the sync-vs-202 question:

- `AFTER INSERT OR UPDATE OR DELETE ON round` fires `enqueue_handicap_calculation()` (`supabase/migrations/20251207150152_replace_handicap_trigger.sql`), which **upserts one row per user** into `handicap_calculation_queue` (`ON CONFLICT (user_id) DO UPDATE`, resetting status/attempts).
- A cron-invoked edge function `process-handicap-queue` (`supabase/functions/process-handicap-queue/index.ts`) drains the queue in batches (default 25, max 3 retries) and recomputes the user's full handicap timeline.
- `submitScorecard` itself only computes the *per-round* numbers inline (score differential, adjusted scores, course handicap via `getRoundCalculations`, `round.ts:44-161`) — cheap arithmetic over ≤18 holes. `updatedHandicapIndex` is written as a copy of the existing index (`round.ts:778`) and corrected later by the queue processor.
- Consequence: **even the trusted web client already lives with an eventually-consistent handicap index.** The synchronous transaction is plain OLTP work (a handful of selects + inserts); there is no long-running computation to hide behind a 202.

### 1.3 Quarantine already exists: pending rounds never touch the handicap

- The queue processor fetches **only** `approvalStatus = "approved"` rounds (`process-handicap-queue/index.ts:192`), and `hasEstablishedHandicap` counts only approved rounds (`round.ts:746-756`).
- Rounds submitted against a pending course/tee inherit `approvalStatus: "pending"` and sit outside the handicap calc until an admin approves the course/tee data via the existing `submissions` audit/approval flow (`round.ts:848-932`, `listMySubmissions`).
- So the "quarantined as unverified rounds excluded from the handicap calc" option from the decision question is **not hypothetical — it is the shipped semantics** for anything touching unvalidated course data. The design question reduces to: which submissions land in quarantine vs get rejected outright.

### 1.4 Validation gaps an external caller can walk through

`scorecardSchema` (`apps/web/types/scorecard-input.ts`) is enforced server-side by tRPC input parsing, and it is stronger than nothing — but several invariants are UI-only or trust the client:

| Invariant | Where enforced today | External-caller exposure |
|---|---|---|
| CR/slope plausibility (CR18 18–90, slope 45–165, par 54–80, distances, per-9 bounds) | zod `teeSchema` (`scorecard-input.ts:23-128`) — server-side ✅ | Covered. Note the deliberately low floors for par-3 courses (Ballerud, CR 26.4 — see comment at `scorecard-input.ts:28-31`). |
| Stroke-index (hcp) uniqueness across 18 holes | zod `superRefine` (`scorecard-input.ts:104-127`) ✅ | Covered. |
| 9-or-18 scores + `nineHoleSection` consistency | zod `superRefine` (`scorecard-input.ts:191-213`) ✅ | Covered. |
| `putts + penaltyStrokes <= strokes - 1` | **UI only** — `maxPuttsForStrokes` in `apps/web/lib/scorecard/hole-detail.ts:55` and the trio widget. zod allows putts 0–20, penalties 0–10 independently (`scorecard-input.ts:174-176`). | API caller can store putts=20 on a 3-stroke hole. Corrupts stats (not handicap — shot detail is "never a handicap-engine input"), but it's persisted garbage. |
| `strokes >= 1` on a played hole | **Nowhere** — zod floor is 0 (`scorecard-input.ts:168`) | 0-stroke holes accepted; nonsense rounds possible. |
| `hcpStrokes` correctness | **Trusted from client** (0–99). Feeds the net-double-bogey cap directly: `netDoubleBogey = par + 2 + score.hcpStrokes` (`packages/handicap-core/src/calculations.ts:344`). The canonical derivation `addHcpStrokesToScores` (`calculations.ts:389-427`) exists but `submitScorecard` never calls it — the web client computes hcpStrokes browser-side. | Bounded damage (cap clamps at par+5) but a buggy/malicious client shifts per-hole caps between par+2 and par+5, skewing adjusted gross score and the stored differential. Should be server-derived and the client value ignored. |
| `approvalStatus` | **Client-supplied field** on the scorecard and course/tee objects; the router only *overrides* it on the pending-tee paths (`round.ts:404, 430, 539`) | An external caller choosing "pending" on approved data harmlessly self-quarantines; the field should simply not exist on the public wire format — server derives it. |
| Course identity match | **By name only, globally**: `eq(course.name, coursePlayed.name)` (`round.ts:370-374`), despite the DB uniqueness being `(name, country, city)` (`schema.ts:122`) | "Sunset GC" in Norway silently attaches to "Sunset GC" in Scotland. For an API accepting free-text course payloads this is a wrong-course data-integrity bug, not just a UX quirk. Catalog-only v1 sidesteps it. |
| teeTime sanity | zod `z.string().datetime()` only | Future-dated and decades-old rounds accepted; both perturb the timeline ordering and `hasEstablishedHandicap` count. |
| Auto-create blast radius | `coursePlayed.approvalStatus === "pending"` → new course row; plus **every tee in `course.tees[]`** becomes a pending teeInfo + 18 hole rows (`round.ts:637-723`); admin notification email per submission (`round.ts:995-1019`) | One buggy client loop = hundreds of junk pending courses/tees + email flood into the same admin queue that guards the painstakingly cleaned 207-course catalog. |

### 1.5 Auth context

`apps/web/server/api/trpc.ts` already accepts `Authorization: Bearer <supabase access token>` with RLS scoping (built for the native app); cookie auth takes precedence. The prod Cloudflare/Vercel challenge on cookie-less requests (429 HTML) is a dashboard fix, out of scope here but a hard prerequisite for any external caller.

---

## 2. Prior art (external, checked July 2026)

### 2.1 Payments-style: Stripe idempotency keys

- Client sends `Idempotency-Key` (≤255 chars, UUID recommended); Stripe persists the **first response — status code and body, including errors** — keyed by (account, key) for 24h and replays it on any retry; reusing a key with a *different* request body is rejected. Source: [Stripe API reference — idempotent requests](https://docs.stripe.com/api/idempotent_requests), [Stripe blog — designing robust and predictable APIs with idempotency](https://stripe.com/blog/idempotency) (checked 2026-07).
- The canonical Postgres implementation is Brandur Leach's [Implementing Stripe-like Idempotency Keys in Postgres](https://brandur.org/idempotency-keys): an `idempotency_keys` table, insert-first "claim" row, request-fingerprint check, response snapshot, and the key row participating in the same transaction as the side effects — which is exactly the property a handicap ledger needs (key committed ⟺ round committed; no window where one exists without the other).
- The standardization effort — IETF `draft-ietf-httpapi-idempotency-key-header` — reached [-07 (Oct 2025)](https://datatracker.ietf.org/doc/html/draft-ietf-httpapi-idempotency-key-header-07) but the draft **expired April 2026** without becoming an RFC ([datatracker status](https://datatracker.ietf.org/doc/draft-ietf-httpapi-idempotency-key-header/), checked 2026-07). `Idempotency-Key` remains the de-facto header name (Stripe, Adyen, PayPal); safe to adopt the name, don't wait for the RFC.

### 2.2 Fitness-style: Strava, Garmin, Terra

- **Strava** (`POST /uploads`): returns **201 with an upload ID; processing is asynchronous** ("mean processing time under 2 seconds"); the client polls `GET /uploads/:id` at ≥1s intervals. Duplicates are detected server-side **on start time / file creation time** and surface as an error string `"…duplicate of activity 21234316"`. Clients pass `external_id` for correlation. Sources: [Strava uploads doc](https://developers.strava.com/docs/uploads/), [Strava community — duplicate filtering](https://communityhub.strava.com/developers-api-7/how-does-strava-filter-duplicate-activities-uploaded-from-the-same-account-11994) (checked 2026-07). The async shape exists because Strava must *parse device files* (FIT/TCX/GPX); a structured-JSON scorecard has no equivalent parse step.
- **Garmin Health/Activity API**: push model — Garmin POSTs summaries to your webhook; every summary carries a unique `summaryId` and **the consumer is expected to dedupe/upsert by it**. Source: [Garmin Activity API](https://developer.garmin.com/gc-developer-program/activity-api/) (checked 2026-07).
- **Terra** (fitness-data aggregator): activity/sleep payloads are uniquely identified by `metadata.summary_id`; on receiving the same ID again "you should update the previous entries" — i.e. **at-least-once delivery + natural-key upsert**, with re-deliveries guaranteed to be supersets. Other types dedupe on `(start_time, end_time)`. Source: [Terra docs — receiving data updates](https://docs.tryterra.co/health-and-fitness-api/managing-user-health-data/receiving-data-updates) (checked 2026-07).
- **GHIN** (the closest domain analogue — official WHS score posting in the US): third-party score-posting access exists (create/update/delete score endpoints) and integrators are expected to pre-validate course/tee identity and score plausibility before posting; course/tee selection comes from GHIN's own course catalog, not free-text. Sources: [SportsFirst GHIN integration checklist](https://www.sportsfirst.net/post/ghin-api-integration-for-golf-apps-in-the-usa-full-implementation-checklist), [Golf Genius — automatic score posting to GHIN](https://docs.golfgenius.com/en/articles/10777808-automatic-score-posting-to-ghin) (checked 2026-07; GHIN's own API docs are behind a partner agreement, so treat details as secondary-source).

**Pattern synthesis.** Fitness APIs converge on *at-least-once + dedupe by a client/source ID* because their data is telemetry: a duplicate step count is annoying. Payment APIs converge on *idempotency-key + response replay* because their writes are ledger entries: a duplicate is a correctness failure. A handicap round is a **ledger entry** (it feeds a regulated index calculation), so the Stripe pattern is the right primary mechanism — with the fitness-style natural-key/external-id dedupe as a complementary net, which notably also catches *cross-client* duplicates (same round entered in the fitness app AND the web UI) that an idempotency key cannot see.

---

## 3. Options

### (a) Idempotency mechanism + store

**A1 — `Idempotency-Key` header, Postgres key table inside the existing transaction (Stripe/Brandur pattern).**
New table e.g. `api_idempotency_key(id, user_id, key, request_fingerprint, round_id, response_status, response_body, created_at)` with `UNIQUE (user_id, key)`. Handler: insert the claim row **in the same `db.transaction`** as the round; on unique-violation, load the stored row → same fingerprint ⇒ replay stored response; different fingerprint ⇒ `422 idempotency_key_reuse`; claim row exists but unfinished ⇒ `409 request_in_flight`. Retention: purge ≥24h (volume is tiny; a weekly cron or opportunistic delete suffices).
- Pros: exactly-once *effect* under retries, atomic with the round insert (no key-without-round or round-without-key window), replays failures deterministically, industry-standard header, trivially testable in the existing integration-test harness (real local Supabase).
- Cons: one new table + ~80 lines of handler logic; requires clients to generate keys (fine — first consumer is in-house); does not catch duplicates submitted with *different* keys.

**A2 — Natural-key dedupe only: unique index on `(userId, teeId, teeTime)` (Strava/Terra style).**
Retries carry the same teeTime, so a plain unique index catches them; respond `409 duplicate_round` with the existing round id (Strava's "duplicate of activity N").
- Pros: one migration, zero client cooperation, also catches cross-client and human double-entry duplicates; DB-enforced so even future code paths can't duplicate.
- Cons: can't replay the original response (a retry of a *failed-after-commit* request gets 409, and the client must then GET the round — acceptable but clumsier); ambiguity between "network retry" and "user genuinely resubmitted after editing scores" (both hit the constraint; an edit flow needs PATCH anyway); two same-user rounds at an identical teeTime on the same tee are essentially impossible legitimately, so false positives are negligible.

**A3 — Upstash Redis idempotency cache.**
- Pros: no migration; Upstash already a dependency (rate limiting).
- Cons: **not atomic with the round insert** — crash between Redis SETNX and Postgres commit either replays a phantom success or blocks a legitimate retry; eviction/TTL semantics are cache semantics, and Stripe itself keeps keys in a *persistent* store precisely because the replay body must survive. For a correctness-critical ledger this is the wrong tool. Keep Upstash for rate limiting only.

**Verdict: A1 + A2 together** (they compose; A2 is one migration and protects even non-API write paths). Add an optional `externalId` column on `round` for consumer-side correlation (Garmin `summaryId` / Strava `external_id` pattern) — not a uniqueness mechanism, just a handle.

### (b) Sync 201 vs 202-accepted async

**B1 — Synchronous 201.**
The transaction is small OLTP work; the expensive full-timeline recalc already runs async behind the Postgres queue. Return the created round (with its per-round `scoreDifferential`) plus an explicit eventual-consistency signal, e.g. `"handicapRevision": "pending"`, and document that the user's index updates within the queue cadence. Optionally expose `GET /v1/me/handicap` for polling; webhooks are a later platform feature.
- Pros: no new infrastructure; matches what the web/native clients already experience; simplest possible consumer contract (POST → 201 → done); errors are immediate and attributable to the request.
- Cons: response's `updatedHandicapIndex` is not final (must be documented, or omitted from the wire format); a very slow queue makes "when is my index updated?" a support question.

**B2 — 202 + upload-status resource (Strava style).**
POST returns 202 + `submissionId`; client polls `GET /v1/round-submissions/:id` until `processed`/`error`/`duplicate`.
- Pros: one uniform place to surface async outcomes (including future quarantine/moderation results); absorbs DB pressure spikes; room to add heavyweight validation later.
- Cons: requires a submission-status table, a worker, and polling logic in every consumer — to hide a transaction that completes in tens of milliseconds. Strava needs it for *file parsing*; a JSON scorecard doesn't. Async validation also *delays* the rejection signal, which is exactly wrong for a strict-validation contract. Serious over-engineering for consumer #1.

**Verdict: B1.** Revisit 202 only if a future consumer does bulk/batch imports.

### (c) Validation strictness & auto-creation

**C1 — Strict-reject, catalog-only v1.**
The public endpoint accepts `{ courseId, teeId, teeTime, nineHoleSection?, scores[], notes?, externalId?, idempotencyKey(header) }` where `teeId` must resolve to an **approved, non-archived** tee (the `round.ts:569-587` lookup already exists). No course/tee object on the wire, so no auto-create, no `approvalStatus` field, no `additionalTees`. Server derives `hcpStrokes` (via `addHcpStrokesToScores`), computes all round numbers, and enforces as 422s with machine-readable codes: scores length ∈ {9,18} and matching section; `strokes >= 1`; `putts + penaltyStrokes <= strokes - 1` (promote the UI rule from `lib/scorecard/hole-detail.ts` into the shared zod schema); teeTime within a sanity window (e.g. not future beyond clock-skew tolerance, not older than N years — exact window is a product decision); natural-key duplicate → 409. Unknown course → 422 `course_not_found`, and the fitness app drives course selection through the existing course-search endpoints.
- Pros: protects the 207-course validated catalog absolutely; sidesteps the name-only course-match bug; gives consumers immediate, actionable errors (the contract consumers actually want to build against); dramatically smaller wire schema than the internal 40-field scorecard — extractable without first refactoring all 700 lines of the tRPC pipeline.
- Cons: an API user at an uncataloged course cannot submit (mitigations: the fitness app deep-links to the web "add course" flow; or a later, explicitly separate `POST /v1/course-submissions` endpoint with its own rate limits and admin batching).

**C2 — Full parity with the web client (auto-create pending courses/tees).**
Handicap-safety is actually fine — pending rounds are quarantined out of the calc by the existing `approvalStatus` filter — but every buggy external loop lands directly in the admin approval queue and the courses table, with an email per submission. The name-only course match makes machine-generated payloads actively dangerous (silent wrong-course attachment).
- Rejected for v1; acceptable later behind a dedicated, rate-limited course-submission endpoint.

**C3 — Accept-with-flag (lenient ingest, mark unverified).**
Insert whatever arrives, flag it, exclude from handicap until verified. This is just C2's quarantine with *less* signal to the consumer: the client gets a 201 and never learns its data was garbage; junk accumulates with no natural cleanup owner. The WHS domain norm (GHIN) is the opposite — integrators pre-validate and the authority rejects. Rejected.

**Verdict: C1**, keeping the existing pending/approved quarantine untouched as the internal mechanism, and explicitly *not* exposing it as an API write path in v1.

---

## 4. Recommendation

Adopt, as the v1 public contract for `POST /v1/rounds`:

1. **Idempotency**: required `Idempotency-Key` header, persisted in a new Postgres `api_idempotency_key` table written inside the same `db.transaction` as the round (Stripe/Brandur pattern: claim row, fingerprint check, response replay, 24h retention); **plus** a unique index on `(userId, teeId, teeTime)` returning `409 duplicate_round` + existing round id; **plus** optional `externalId` for consumer correlation. No Upstash for idempotency state.
2. **Sync 201**, documenting that the handicap index updates asynchronously (the queue + edge-function pipeline that already exists). No 202/polling resource.
3. **Strict-reject catalog-only validation**: approved `courseId`/`teeId` required; no auto-create from the API; server-derived `hcpStrokes` and `approvalStatus`; promote the putts/penalties budget and `strokes >= 1` into the shared zod schema (which hardens the web path for free); teeTime sanity window; machine-readable 422 error codes.

Confidence: **high** on (a) and (b) — both are strongly determined by facts already in the codebase (zero dedupe + compensating-delete pain; recalc already async) and by unambiguous industry precedent. **Medium-high** on (c): strict catalog-only is clearly right for consumer #1 (same developer, can integrate course search), but the "player at an uncataloged course" gap will need the course-submission endpoint sooner than one might hope if third parties ever onboard.

### Open questions

1. Does a `409 duplicate_round` response need to include the full existing round body, or just its id/URL? (Affects whether the natural-key path needs a read-back inside the handler.)
2. Free-tier interaction: does an idempotent *replay* of a 201 count against `FREE_TIER_ROUND_LIMIT` re-checks, and should the compensating-delete race path (`round.ts:949`) be replaced by counting inside the transaction now that a dedupe table exists? (The post-commit delete can strand a persisted idempotency key pointing at a deleted round.)
3. Key retention vs offline clients: 24h matches Stripe, but a fitness app queuing submissions offline for a weekend could retry after key expiry — the natural-key index then catches it, returning 409 instead of a replayed 201. Is that acceptable contract behavior, or should retention be 7 days?
4. Server-deriving `hcpStrokes` at the API boundary vs also changing the web path: the web client currently computes them browser-side — unify (preferred; one derivation in `@handicappin/handicap-core`) or accept divergence temporarily? Needs a parity check that `addHcpStrokesToScores` reproduces the web client's values on historical rounds.
5. Should the natural key be `(userId, teeTime)` (catches same-round-different-tee double entry across clients) instead of `(userId, teeId, teeTime)`? Stricter, but risks a false positive for a genuine same-instant... practically nil; decide with the first consumer.
6. `teeTime` sanity window bounds (future skew tolerance; how far back historical imports are allowed) — product decision, affects whether the fitness app can backfill old rounds.

### Sources

- Codebase: `apps/web/server/api/routers/round.ts`, `apps/web/types/scorecard-input.ts`, `apps/web/db/schema.ts`, `packages/handicap-core/src/calculations.ts`, `apps/web/lib/scorecard/hole-detail.ts`, `supabase/migrations/20251207150152_replace_handicap_trigger.sql`, `supabase/functions/process-handicap-queue/index.ts` (read 2026-07-20, branch `main` @ d06c827).
- [Stripe — Idempotent requests](https://docs.stripe.com/api/idempotent_requests); [Stripe blog — idempotency](https://stripe.com/blog/idempotency)
- [Brandur Leach — Implementing Stripe-like Idempotency Keys in Postgres](https://brandur.org/idempotency-keys)
- [IETF draft-ietf-httpapi-idempotency-key-header-07](https://datatracker.ietf.org/doc/html/draft-ietf-httpapi-idempotency-key-header-07) (expired Apr 2026, [status](https://datatracker.ietf.org/doc/draft-ietf-httpapi-idempotency-key-header/))
- [Strava — Uploading to Strava](https://developers.strava.com/docs/uploads/); [Strava community — duplicate filtering](https://communityhub.strava.com/developers-api-7/how-does-strava-filter-duplicate-activities-uploaded-from-the-same-account-11994)
- [Garmin — Activity API](https://developer.garmin.com/gc-developer-program/activity-api/)
- [Terra — Receiving health data updates](https://docs.tryterra.co/health-and-fitness-api/managing-user-health-data/receiving-data-updates)
- [SportsFirst — GHIN API integration checklist](https://www.sportsfirst.net/post/ghin-api-integration-for-golf-apps-in-the-usa-full-implementation-checklist); [Golf Genius — automatic score posting to GHIN](https://docs.golfgenius.com/en/articles/10777808-automatic-score-posting-to-ghin) (secondary sources; GHIN partner docs are gated)
