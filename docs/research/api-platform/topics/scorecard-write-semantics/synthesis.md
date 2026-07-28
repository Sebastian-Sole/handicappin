# Synthesis: scorecard-write-semantics

**Verdict: NO CONSENSUS (partial).** The panel converges hard on sub-question (b) and on the
state-store half of (a), but two load-bearing pieces of the recommendation — the idempotency
*mechanism* and the catalog-only validation posture toward the first consumer — attracted
substantive, unresolved counter-positions (green hat's externalId alternative was never
evaluated; blue hat, red hat, black hat, and pre-mortem all independently flag catalog-only as
a product decision the owner must make, not an engineering default). These are not
structurally-negative nitpicks; they change the shape of the v1 contract.

Panel: white-hat AGREE, yellow AGREE, blue AGREE (with decision-split demand), red MIXED,
black MIXED, green MIXED, pre-mortem MIXED.

---

## 1. What IS decided (converged — treat as locked, subject to the conditions in §3)

### (b) Sync vs async — DECIDED, unanimous
Synchronous **201** from `POST /v1/rounds`. No 202/polling resource. The transactional
pipeline already returns a provisional `updatedHandicapIndex` computed in-transaction; the
authoritative timeline recompute is *already* async (AFTER-trigger →
`handicap_calculation_queue` → `process-handicap-queue`). The response documents this
honestly: return the provisional index and `handicapRevision: "pending"`, and the docs must
state the returned index is provisional (white-hat nuance). Every perspective, including both
structurally-negative ones, endorsed this; pre-mortem: "202 would be Strava cosplay for a
millisecond transaction."

### (a-store) Postgres, not Upstash — DECIDED, unanimous
Idempotency/dedupe state lives in Postgres, atomic with the round row. The rejection is
grounded in in-repo scar tissue: the free-tier compensating-delete path (round.ts:949-992,
Supabase REST count + 5 sequential non-transactional deletes) is a live demonstration of what
non-atomic cross-store coordination costs. Replay state must be exactly as durable and as
atomic as the row it describes.

### (a-natural-key) A DB-level uniqueness constraint on rounds — DECIDED in principle
The round table currently has **zero unique constraints**; a natural-key unique index protects
every write path (web, native, watch, API) and yellow hat correctly calls it a gift to the
whole product. But the key as proposed — `(userId, teeId, teeTime)` — is miscalibrated and
must be re-specified before migration (see conditions C2): it omits `nineHoleSection`
(false-409s legitimate front/back 9-hole pairs), and teeTime semantics are unpinned
(browser wall-clock rounded to the minute on web vs date-only midnight timestamps from
fitness-app historical backfill → legitimate same-day collisions).

### (c-partial) Strict server-side validation, no auto-create, machine-readable errors — DECIDED
Converged elements of the validation posture:
- **No auto-create of pending courses/tees from the API path.** The amplification cost
  (N pending tees + 18 holes + admin email per bad submission) and the name-only matching bug
  (round.ts:370 vs the (name,country,city) unique index) make this unanimous.
- **Server-derived `hcpStrokes` and `approvalStatus`** at the API boundary. The authoritative
  async recompute already ignores client hcpStrokes (timeline.ts:134,
  `addHcpStrokesToScores`), so this aligns the sync path with what the queue already does.
- **Machine-readable 422 error codes**, teeTime sanity window (sized for historical backfill —
  see C6), `strokes >= 1` and `putts+penalties <= strokes-1` enforced server-side *for API
  submissions*.
- Keep the existing pending/approved quarantine as the internal mechanism.

What is NOT decided is what happens when the course isn't in the catalog (§2, Q1) and whether
the invariant promotion also lands in the *shared* zod schema used by web/native (§2, Q3).

---

## 2. What is NOT decided — questions for the owner (decidable, one by one)

### Q1 — Catalog-miss handling for the fitness app (the dominant open risk)
The catalog is ~207 validated courses (Norway + Scotland). The fitness app's users play
everywhere. Four perspectives independently concluded that `422 course_not_found` is plausibly
the **majority** response on day one — "the core loop breaking, not an edge case" (red hat);
"a deadlock that starves the launch consumer" (pre-mortem). GHIN's catalog-only precedent only
works because GHIN's catalog is jurisdiction-complete; ours is not. Blue hat: this is a
product/coverage decision requiring owner sign-off, not an engineering default.

**Decide one of:**
1. **Catalog-only v1 as recommended** — accept in writing that the fitness app hard-fails
   outside the 207-course catalog, with a deep-link to the web add-course flow. Cheapest;
   protects the validated-catalog moat; riskiest for integration traction.
2. **"Manual rounds" (green hat's reframe)** — WHS math needs only CR/slope/par, not a catalog
   row. Accept client-supplied ratings into the *already-shipped* pending/approvalStatus
   quarantine ("round recorded, excluded from handicap until course matched"), zero catalog
   writes, zero admin email. Strava manual-activity analogue. Cheaper and safer than a course-
   submission endpoint; keeps the round data.
3. **Rate-limited course-submission endpoint in the v1 milestone** — the research's "later"
   option pulled forward, with the name-matching bug fixed first.

*Input needed to decide:* a coverage estimate — where do the fitness app's actual/expected
users play relative to the catalog? (Owner knows the consumer; nobody on the panel does.)

**Sub-decision riding on Q1:** the public **course/tee search-resolve read endpoint** must be
in v1 scope regardless of the answer — catalog-referencing writes are unusable without a way
to obtain a `teeId` (green hat; unchallenged, effectively converged, but it's new scope the
owner should acknowledge).

### Q2 — Idempotency mechanism: which of three shapes?
The research recommends a Stripe-style `Idempotency-Key` table written inside the existing
long transaction. Two substantive attacks survived:

- **Black hat:** in-transaction key claim is *not* the Brandur pattern — concurrent retries
  block on the row lock for the full ~700-line pipeline transaction, turning mobile retry
  storms into Supabase pooler connection exhaustion on serverless Vercel. The real pattern
  claims the key in a separate short transaction. Choose the full state machine or don't build
  the table; the middle ground has the lock-contention cost without the recovery semantics.
- **Green hat:** an unevaluated simpler option may dominate for v1 —
  **`externalId` as THE idempotency mechanism**: `UNIQUE(userId, externalId)` on the round
  table, permanent (dissolves the 24h-expiry question), no new table/retention cron, and
  "replay-by-lookup" (return the existing round) instead of response snapshots — which Stripe
  needs only because charges aren't re-derivable by GET; rounds are. Optionally reframe as
  `PUT /v1/rounds/{externalId}`. The research dismissed externalId as "just a handle" without
  analysis. Red hat independently: full Stripe machinery for one in-house consumer is
  "slightly rich"; natural-key 409 covers ~95% of real retry pain.

**Decide one of:**
1. Full Brandur state machine (separate short claim transaction, fingerprint,
   violation-catch replay, purge job) — most robust for future unknown third parties,
   most machinery now.
2. **externalId-primary**: unique `(userId, externalId)` + replay-by-lookup, natural-key index
   as backstop; `Idempotency-Key` header addable later, non-breaking.
3. Natural-key-only for v1 (index + 409/lookup), no key mechanism at all yet.

*Explicitly rejected by the panel:* the recommended middle ground (key row inside the existing
long transaction).

**Sub-decision:** duplicate response semantics — green hat argues **200 with the existing
round** on an identical-body duplicate (Terra/Stripe-success style) beats 409 for retry loops;
reserve 409/conflict for same-key-different-body. Cheap to decide alongside Q2.

### Q3 — Does web/native hardening ride in this lock, or split out?
The recommendation smuggles web-client changes into an API-contract decision (blue hat's scope-
drift finding): promoting `strokes>=1` / `putts+penalties<=strokes-1` into the **shared** zod
schema and flipping web to server-derived hcpStrokes changes web behavior — historical rounds
and edit flows may violate the new invariants, and the live-round local-first sync (PR #135)
ships partial states that could start hard-failing.

**Decide:** (1) split into a separate decision gated on the historical-data audit + hcpStrokes
parity check + live-round regression pass (blue/pre-mortem position, recommended by the
synthesizer), or (2) keep bundled and make those checks launch blockers for the whole
endpoint. Enforcing the invariants *API-side only* is already locked (§1) and is unaffected.

### Q4 — Key retention (only if Q2 → option 1)
Don't default to Stripe's 24h. Consumer #1 is in-house: ask how long its offline queue can
hold a round, and set retention (24h vs 7d) from that answer. Moot under Q2 options 2/3.

---

## 3. Conditions absorbed from the critical reviews (launch blockers, whichever way Q1–Q4 go)

- **C1 — Free-tier compensating-delete race (round.ts:949-992).** Raised independently by five
  perspectives; the single most-converged item on the board. A committed idempotency
  key/externalId row must never outlive its deleted round — that replays a 201 for a
  nonexistent round, the exact phantom-success failure used to reject Upstash. Move the
  over-limit re-check inside the transaction (or poison/clean the dedupe row with the
  compensation) **in the same change** as any dedupe mechanism. Not an open question; a
  blocker.
- **C2 — Prod duplicate scan + natural-key re-specification BEFORE the migration.** Scan a
  prod **dump** (not migration history — Ballerud lesson; session pooler per IPv6 gotcha) for
  existing natural-key collisions; include `nineHoleSection` in the key; pin teeTime
  granularity/timezone/date-only-backfill semantics. The same query resolves the
  (userId,teeTime) vs (userId,teeId,teeTime) question with data.
- **C3 — Cloudflare/Vercel challenge-mode bypass rule** for the API path must exist and be
  verified before launch; the 429 Security Checkpoint blocks every non-browser client
  regardless of anything decided here. Dashboard-side; schedule it, don't discover it in
  launch week.
- **C4 — hcpStrokes parity check** (`addHcpStrokesToScores` vs stored browser-computed values
  on historical rounds) before any server-derivation cutover; cheap — the function already
  runs in the queue path. Prerequisite for Q3 either way.
- **C5 — Client version tolerance.** Web and native must handle the new 409/conflict semantics
  (and, if Q3 bundles, the hardened shared schema) before the index/schema ship; native needs
  a version-tolerance plan under the parity rule (in-field app versions can't be force-updated).
- **C6 — teeTime sanity window sized for historical backfill** — fitness-app import of old
  rounds is a headline v1 benefit; an over-tight window quietly kills it.

---

## 4. Strongest surviving dissent

Pre-mortem/red-hat, on the recommendation as written: **strict catalog-only v1 starves the
launch consumer** — with a 207-course Norway+Scotland catalog, `422 course_not_found` is the
modal response for a fitness app whose users play everywhere, and the deferred course-
submission endpoint never ships because the API never gets traction. The mechanics of the
recommendation are sound (its sync-201, Postgres-atomicity, and validation-strictness cores
survived every hat); the launch-sequencing around the catalog is where the plan dies if the
owner doesn't decide Q1 deliberately.

## 5. Suggested discussion order

Q1 (catalog-miss — changes v1 scope the most) → Q2 (mechanism — changes the schema/migration)
→ Q3 (web hardening split) → Q4 (retention, if reached). C1–C6 need no discussion, only
scheduling.
