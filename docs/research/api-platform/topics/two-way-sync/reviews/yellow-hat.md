# Yellow Hat Review — two-way-sync

**Verdict: AGREE** (with enthusiasm). Option B is not merely the cheap choice — it is the value-maximizing choice, and the research undersells some of its upside.

## Why this recommendation works

### 1. It buys "instant-feeling" UX at effectively zero build cost
The single most valuable moment in the fitness-app integration is the post-submit reveal: "your new handicap index is X." Option B delivers that moment near-instantly whenever the app is foregrounded — which is exactly when the user is staring at the screen after submitting a scorecard. And it does so by *copying a pattern that already runs in production* (`apps/web/components/billing-sync.tsx`: postgres_changes UPDATE on `profile` filtered by user id, treated as a refetch signal). Verified in-repo: `profile` — the very table carrying `handicapIndex` — was added to the `supabase_realtime` publication in migration `20251107000000_enable_profile_realtime.sql`. The expensive parts (publication, RLS scoping, the subscription idiom, the at-most-once/refetch-not-trust design) are already paid for. This is the rare case where the deluxe UX and the minimal build are the same line item.

### 2. The physics argument is airtight, and it's a gift
The recalc pipeline (trigger → `handicap_calculation_queue` → pg_cron every minute → `process_handicap_updates` RPC; all verified in migrations `20251207150151`–`20251207213412`) sets a ~60–90s freshness floor that NO transport can beat. That means the team cannot lose by choosing polling: webhooks would cost months and deliver *identical* perceived latency. Better still, the floor equals what handicappin's own web/native users get today — so the fitness app launches at first-party parity on day one. "Your integration is as fresh as our own app" is a genuinely strong story for the first consumer and for future API marketing.

### 3. The Realtime accelerator dodges the one known production landmine for free
The Cloudflare/Vercel challenge wall (429 HTML on cookie-less requests) is the documented prod gotcha for any non-browser client. The websocket goes to `*.supabase.co`, not Vercel — so the highest-value read path (live index updates) simply routes around the problem while topic 3 solves it properly for the write path. A free bypass of the project's scariest integration hazard is a second-order benefit worth naming loudly.

### 4. "Nothing to un-build" is real optionality, not a platitude
Every layer is additive: polling stays the contract, Realtime layers on top, and the deferred webhook plan (outbox at `process_handicap_updates` + approval trigger, QStash delivery, Standard Webhooks signing) slots in later without touching the v1 contract. The pre-committed triggers convert "deferred" from procrastination into a real option with a strike price: when the first server-backed third party shows up, the repo already has the emission chokepoints (trigger→queue→cron→pg_net runs twice today) and the vendor relationship (Upstash). The team is buying a cheap call option on platform-grade push instead of paying full price for it before any buyer exists.

### 5. Killing the sync-cursor endpoint is a hidden win
The research correctly spots that "changes since cursor" is a trap in this schema: `round` has no `updated_at` (verified — the only `updated_at` columns in `apps/web/db/schema.ts` are on `pending_lifetime_purchase` and `email_preferences`) and rounds are hard-deleted, so a cursor means schema migration + tombstone strategy + a contract to maintain forever. Declining it saves the largest single chunk of accidental scope in this topic, and the open question wisely pairs the eventual tombstone decision with the webhook outbox — one event log serving both is elegant future economics.

### 6. What this unlocks later
- The polling contract doubles as the first page of real API documentation — the v1 fitness integration produces reusable platform assets, not throwaway glue.
- The billing-sync pattern generalizes: adding `round` to the publication is a one-line migration when edit/delete liveness is wanted.
- The Strava/Garmin prior art gives the team a ready-made roadmap narrative for investors/partners: "polling now, webhooks at third-party scale, exactly how the incumbents phased it."

## Where the upside depends on inputs (should be resolved, not blockers)

1. **Topic 2 coupling**: the entire accelerator (point 1) and the challenge-wall bypass (point 3) evaporate under PAT/OAuth-only auth. The value case for Option B over plain Option A rides on shared-project Supabase JWTs. If topic 2 is genuinely undecided, decide it with this benefit on the scale.
2. **The hardcoded first-party webhook middle path**: if the fitness app has a backend, a single pg_net → fitness-backend hook (the RevenueCat-style pattern the repo already runs for round approvals) is nearly free and would be the best-value answer for edits/approvals while the app is closed. Worth answering the "backend?" question before locking, because it could upgrade the recommendation at trivial cost.
3. **Set the UX expectation deliberately**: the ~60–90s post-submit window is fine *if designed for* (a "recalculating…" state that resolves live via Realtime is actually a delightful moment — the number visibly updates). Ship that framing, and the latency floor becomes a feature, not an apology.

## Sharpest one-liner
The recommendation's best quality is that its cheapest path and its best-UX path are the same path — the production billing-sync pattern plus an already-published `profile` table means the team gets near-real-time for the price of polling.
