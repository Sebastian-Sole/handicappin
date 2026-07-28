# Topic 7 — two-way-sync: Does v1 need eventing, and what is the cheapest credible path?

**Date:** 2026-07-20
**Status:** Research complete
**Decision question:** For the fitness app to reflect state changes originating in handicappin
(handicap index updated after recalc, pending course approved, round edited/deleted on web), is
polling a "changes since cursor" REST endpoint sufficient for v1, or is push needed — and if push,
outbound webhooks (QStash/Svix/hand-rolled) or Supabase Realtime while v1 shares the Supabase
project?

---

## 1. Codebase findings (ground truth)

### 1.1 The handicap recalc is ALREADY asynchronous — push cannot beat the queue

The critical discovery: `submitScorecard` does **not** return the post-recalc handicap index.

- The round row is inserted with `updatedHandicapIndex: userProfile[0].handicapIndex` — i.e. the
  **pre-recalc** index (`apps/web/server/api/routers/round.ts:778`).
- A DB trigger `trigger_handicap_recalculation` fires on every INSERT/UPDATE/DELETE on `round` and
  upserts the user into `handicap_calculation_queue` (one row per user)
  (`supabase/migrations/20251207150152_replace_handicap_trigger.sql`).
- `pg_cron` runs **every minute** (`* * * * *`) and POSTs to the `process-handicap-queue` edge
  function (`supabase/migrations/20251207150153_schedule_queue_processor.sql`, later hardened in
  `20260430120000_secure_queue_cron_with_secret.sql`).
- The edge function recalculates the full chain and calls the `process_handicap_updates` RPC,
  which atomically rewrites affected round rows and `profile.handicapIndex`
  (`supabase/functions/process-handicap-queue/index.ts`).

**Consequence:** the authoritative new index lands in `profile.handicapIndex` up to ~60–90 s after
submission, *for every surface including handicappin's own web and native apps*. No transport
choice (webhooks, Realtime, SSE) can deliver the new index faster than the recalc cadence.
The freshness floor is set by pg_cron, not by the sync mechanism. Any push design that promises
"instant index in the submit response" would require re-architecting the recalc pipeline —
firmly out of v1 scope.

Also note: the first-party apps themselves have **no push for handicap updates today** — the web
app learns the new index on the next React Query fetch/navigation (no `refetchInterval` anywhere
in `apps/web` or `apps/native`). Demanding stronger freshness for the fitness app than handicappin
gives itself would be over-engineering.

### 1.2 Supabase Realtime is already in production use — on exactly the right table

`apps/web/components/billing-sync.tsx` subscribes to `postgres_changes` `UPDATE` events on
`public.profile` filtered by `id=eq.${userId}`, and `profile` is already in the realtime
publication (`supabase/migrations/20251107000000_enable_profile_realtime.sql`:
`ALTER PUBLICATION supabase_realtime ADD TABLE profile`).

`profile` is precisely where `handicapIndex` lives. If the fitness app authenticates against the
same Supabase project (topic 2, option (a)), it can copy the billing-sync pattern verbatim and
receive handicap-index updates with **zero backend work**: RLS scopes events to the user's own
row (policy "Users can view their own profile", `apps/web/db/schema.ts:69-74`).

Two bonus properties:

- **Bypasses the Cloudflare/Vercel challenge wall.** Realtime websockets connect to
  `*.supabase.co`, not to handicappin's Vercel deployment — the prod 429 "Security Checkpoint"
  gotcha (topic 3) doesn't apply to this channel at all.
- `round` is **not** in the publication today; round-edit/delete events would need a one-line
  migration (`ALTER PUBLICATION supabase_realtime ADD TABLE round`) — RLS on `round` already
  restricts SELECT to the owner, though note the RLS caveat on DELETE events (§2.1).

### 1.3 A "changes since cursor" endpoint is NOT cheap here

- `round` has **no `updated_at` column** — only `createdAt` (`apps/web/db/schema.ts:231-262`).
  `profile` has no `updatedAt` either. Only `pendingLifetimePurchases` and `emailPreferences`
  carry `updated_at` (schema lines 505, 586).
- Rounds are hard-deleted (RLS delete policy exists; no soft-delete/tombstone anywhere), so a
  cursor endpoint cannot express deletions without adding tombstones or an event log.
- Therefore a proper sync-cursor endpoint requires: `updated_at` + trigger to maintain it,
  a tombstone strategy (soft delete or an events table), and index changes. That is a real
  schema project, not a route handler. Plain **resource polling** (GET current profile +
  GET rounds list) needs none of this.

### 1.4 Outbound-delivery precedents that DO exist

- **Inbound** webhook machinery is mature: Stripe + RevenueCat routes with timing-safe auth,
  `webhook_events` idempotency table, out-of-order guards, retry-aware 200-semantics
  (`apps/web/app/api/webhooks/revenuecat/route.ts`).
- **Outbound HTTP from Postgres already happens twice**, both fire-and-forget via `pg_net`:
  1. pg_cron → `net.http_post` → process-handicap-queue edge function (every minute);
  2. a trigger on round approval-status change → `net.http_post` → the
     `/api/notifications/round-approval` route, with secrets pulled from Supabase Vault
     (`supabase/migrations/20260412120000_notify_round_approval_change.sql`).
- So the team already operates the ingredients of a hand-rolled webhook system (DB trigger →
  queue table → cron → HTTP with secret auth). What does **not** exist: consumer endpoint
  registration, HMAC signing of outbound payloads, retry/backoff with dead-lettering, replay
  tooling, or any multi-consumer fan-out. `pg_net.http_post` itself is async fire-and-forget —
  failures land in `net._http_response` and nothing retries them.
- No QStash or Svix usage anywhere in the repo (Upstash is used only for rate limiting/Redis).

### 1.5 The "pending course approved" event already has a notification seam

The round-approval trigger (§1.4) is the natural emission point for a future
`round.approval_changed` event; course approval flows through the same admin path. For v1, the
user already gets an **email** on approval/rejection — the fitness app reflecting it on next
poll/app-open is consistent with that UX.

### 1.6 The consumer is (probably) a mobile app — webhooks may have nowhere to land

Webhooks are server-to-server. If the fitness app is a mobile client without its own backend
(unconfirmed — open question), outbound webhooks **cannot reach it at all**; the only true
background push to a phone is APNs/FCM, and neither webhooks nor Realtime sockets survive app
backgrounding. Realtime/polling both cover the foreground case; background notification is a
separate (non-v1) feature regardless of transport.

---

## 2. External findings (July 2026)

### 2.1 Supabase Realtime: viable but with documented caveats

Source: [Supabase Postgres Changes docs](https://supabase.com/docs/guides/realtime/postgres-changes),
[Broadcast docs](https://supabase.com/docs/guides/realtime/broadcast),
[Broadcast from Database blog](https://supabase.com/blog/realtime-broadcast-from-database) (checked 2026-07-20).

- **Authorization:** `postgres_changes` authorizes *every event against each subscriber's RLS*.
  Correctly scoped for our per-user filter. Caveat: **RLS is not applied to DELETE events** (only
  primary keys are emitted in old records) — relevant if `round` is ever added to the publication;
  round PKs are serial ints, low sensitivity, but worth knowing.
- **Scaling:** changes are processed on a single thread; Supabase now explicitly recommends
  Broadcast over Postgres Changes for scale ("Postgres Changes does not scale as well as
  Broadcast"; guidance threshold ~3,000 concurrent subscribers on the same changes). At
  fitness-app-v1 scale (hundreds of users) this is a non-issue; the existing billing-sync already
  accepts this trade.
- **Delivery guarantees:** effectively at-most-once from the client's perspective — no replay of
  events missed while disconnected. Docs do not promise durable delivery. **Realtime can therefore
  only ever be an accelerator on top of a fetch-based source of truth** (fetch on connect/reconnect,
  Realtime for liveness) — which is exactly how billing-sync uses it (JWT refresh + router.refresh
  on event, normal reads otherwise).
- Direction of travel: Supabase is steering toward Broadcast-from-Database (`realtime.send()` /
  `broadcast_changes()` triggers, private channels with RLS-authorized topics). If Realtime usage
  grows past v1, the migration path is Postgres Changes → Broadcast triggers, not a rewrite.
- Dependency: Realtime requires the consumer to hold a Supabase JWT for **this** project. It lives
  or dies with topic 2's outcome — shared-project auth (a) makes it free; a PAT/API-key model (c)
  kills it (no Supabase JWT to open the socket with).

### 2.2 Prior art: what fitness APIs actually do

- **Strava** ([Webhook Events API](https://developers.strava.com/docs/webhooks/),
  [rate limits](https://developers.strava.com/docs/rate-limits/)): pushes thin webhook events
  (object_type/aspect_type/object_id — a *notification*, not the payload; consumer fetches the
  object). One subscription per application. Explicit motivation: webhooks exist to eliminate
  polling because rate limits (100 req/15 min, 1000/day per athlete) make polling expensive at
  third-party scale. Lesson: webhooks are the **third-party-scale** answer, driven by rate-limit
  economics, not a v1 requirement for a single first-party consumer.
- **Garmin Health API** ([Open Wearables guide](https://openwearables.io/blog/garmin-api-push-notifications-how-callback-sync-works),
  [Garmin Health API](https://developer.garmin.com/gc-developer-program/health-api/)): push-only
  (Ping/Pull or full Push to registered callback URLs); no polling endpoint at all. This is the
  far end of the spectrum and assumes every consumer runs a server.
- **Terra** ([Garmin integration](https://tryterra.co/integrations/garmin)): normalizes provider
  pushes and re-delivers via webhooks to the developer's callback URL — again server-to-server.
- Pattern across the space: **thin event + fetch-back** (Strava-style) is the convergent design
  when webhooks do arrive; payload-bearing pushes (Garmin) are the exception. For a future
  handicappin webhook this argues for `{event: "handicap.updated", userId, occurredAt}` +
  consumer GETs the profile — which keeps signing/PII exposure minimal.

### 2.3 Delivery infrastructure, if/when push is built

- **Svix** ([pricing](https://www.svix.com/pricing/), checked 2026-07-20): free tier 50k
  messages/month, then $0.0001/msg; next tier is **$490/month Professional** — a brutal cliff for
  an indie product. Svix is the "webhooks as a product" option: per-consumer endpoint management,
  signing, retries, consumer-facing portal. Overkill until real third parties exist; the free
  tier would however cover a third-party beta.
- **Upstash QStash** ([pricing](https://upstash.com/pricing/qstash), checked 2026-07-20): free
  500 msgs/day; pay-as-you-go $1 per 100k messages; built-in retries with exponential backoff
  (each retry billed as a message) and a **dead-letter queue with inspect/replay**. Upstash is
  already a dependency (Redis/ratelimit), so QStash adds no new vendor. QStash is a *delivery
  arm* (you still own endpoint registry + signing), but it deletes the hardest 60% of hand-rolled
  webhooks (retry state machine, DLQ).
- **Hand-rolled**: the repo's existing trigger→queue-table→pg_cron→HTTP pattern generalizes to a
  transactional-outbox webhook sender, but pg_net gives no retries/signing/DLQ — all of that
  becomes owned code. This is exactly the "silently doubles the project" scope the topic warns
  about.
- **Standard Webhooks** ([spec](https://github.com/standard-webhooks/standard-webhooks)): the
  HMAC-SHA256 signing convention adopted by OpenAI, Anthropic, Supabase, Twilio, Svix et al. —
  when webhooks are eventually built, sign to this spec (reference libs in TS exist); don't invent
  a scheme.

### 2.4 What polling costs us

The inbound REST path goes through the Cloudflare/Vercel challenge wall (topic 3 must solve this
for the write path anyway — polling adds no *new* ingress problem). Rate-limit budget: on-app-open
fetch + a post-submit poll loop (e.g. 5 polls over 90 s) is trivially within Upstash per-user
limits. There is no per-request infra cost concern at v1 scale.

---

## 3. Options

### Option A — Resource polling only (no eventing infra)

Fitness app: after submit, poll `GET /v1/profile` (or a purpose-built
`GET /v1/handicap`) every ~15 s until the index/`revision` changes (bounded by the ≤90 s recalc
cadence), plus refetch on app-open/foreground for edits/approvals made in handicappin.

- **Pros:** zero new infrastructure; no schema changes (plain resource reads, not a sync cursor);
  matches the freshness first-party apps get today; contract is trivially documentable; works
  under ANY topic-2 auth outcome.
- **Cons:** up to app-open staleness for changes made while the fitness app is closed (identical
  to Realtime/webhooks for a backgrounded mobile app, so mostly theoretical); post-submit UX shows
  a "recalculating…" state for up to ~90 s; a genuine "changes since cursor" endpoint (if later
  demanded) needs `updated_at` + tombstones on `round`.

### Option B — Polling as contract + Supabase Realtime as accelerator (recommended)

Everything in Option A, plus: while topic 2 lands on shared-project auth, the fitness app copies
the billing-sync pattern — subscribe to `postgres_changes UPDATE on profile id=eq.<uid>`, treat an
event as "refetch now". Optionally add `round` to the publication (one migration) for edit/delete
liveness.

- **Pros:** near-instant index updates in the foreground at **zero backend cost** (table already
  published, pattern already in prod); bypasses the Cloudflare challenge wall entirely; degrades
  gracefully to Option A (no replay → polling stays the source of truth, exactly billing-sync's
  design); nothing to un-build later — Realtime is additive.
- **Cons:** couples the accelerator to shared-project auth (dies if topic 2 chooses PAT/OAuth-only;
  polling contract survives); at-most-once delivery, no replay; `postgres_changes` is Supabase's
  legacy-ish path (they now steer to Broadcast — fine at this scale, migration path exists); RLS
  not applied to DELETE events if `round` is published.

### Option C — Outbound webhooks now (QStash-backed outbox, or Svix)

Build the platform-grade path immediately: `webhook_endpoints` table, transactional outbox written
inside `process_handicap_updates` and the approval trigger, QStash (or Svix) for delivery with
retries/DLQ, Standard-Webhooks HMAC signing, replay tooling.

- **Pros:** the "real platform" answer third parties will eventually need; Strava/Garmin/Terra all
  converge here; QStash removes the retry/DLQ half at ~$1/100k msgs with no new vendor; emission
  chokepoints already exist in the codebase.
- **Cons:** useless to v1 if the fitness app has no backend (webhooks are server-to-server —
  unconfirmed but likely for a mobile app); still doesn't notify a backgrounded phone; endpoint
  registry + signing + secret rotation + docs are all new owned surface — the classic
  scope-doubler; delivers the index no faster than polling because the recalc queue (60 s cron)
  is the freshness floor; Svix's paid cliff is $490/mo.

---

## 4. Recommendation

**Option B — polling is the v1 contract, Supabase Realtime is a free foreground accelerator,
outbound webhooks are explicitly deferred to the third-party phase.** Confidence: **high**.

"Polling now, webhooks when third parties arrive" is the honest answer, and the codebase makes it
unusually cheap: the recalc pipeline is already asynchronous with a hard ~60 s freshness floor
that no push transport can beat; the exact table the fitness app cares about (`profile`, carrying
`handicapIndex`) is already in the realtime publication with a production-proven subscription
pattern to copy; and the first-party apps themselves live happily on fetch-on-navigation
freshness. Meanwhile every webhook prerequisite (consumer endpoint registry, signing, retries,
DLQ, replay) is net-new owned scope that may have no consumer at all if the fitness app is a
pure mobile client.

Concrete v1 shape:
1. Submit response returns the round + `handicapRevision`/`recalculationPending: true`.
2. Fitness app polls the profile/handicap read endpoint post-submit (15 s interval, ~2 min cap)
   and refetches on app-open.
3. If (and only if) topic 2 lands on shared-project Supabase auth: subscribe to `profile` UPDATE
   via Realtime as a "refetch now" signal — copy `billing-sync.tsx`.
4. Do **not** build a "changes since cursor" endpoint in v1 (requires `updated_at` + tombstones
   on `round`); plain resource reads suffice for one consumer.

Pre-committed triggers for building webhooks (phase 2): first third-party consumer with a server;
or per-user polling rate-limit pressure (the Strava lesson); or a product need to push into a
consumer's backend (e.g. fitness app grows a server that stores handicap history). When triggered:
transactional outbox in `process_handicap_updates` + approval trigger, QStash for
delivery/retries/DLQ (vendor already in stack, ~$1/100k msgs), thin Strava-style event payloads,
Standard Webhooks HMAC signing. Svix only if a consumer-facing endpoint portal becomes worth
$490/mo.

## 5. Open questions

1. **Does the fitness app have its own backend?** If yes, a single hardcoded first-party webhook
   (pg_net trigger → fitness backend, RevenueCat-style shared secret) becomes a credible cheap
   middle path; if no, webhooks are moot for v1 and the deferral is airtight.
2. **Topic 2 dependency:** shared Supabase project or not? The Realtime accelerator only exists
   under shared-project auth (a Supabase JWT is required to open the socket).
3. **Product confirmation of freshness:** is "index updates within ~90 s while app open, on next
   open otherwise" acceptable UX for the fitness app's post-submit screen? (It equals what
   handicappin's own users get.)
4. **Does the fitness app need background notification** ("your handicap dropped to 12.4")? That
   is APNs/FCM push-notification work (a first-party feature, not an API-platform feature) and is
   unsolved by webhooks *and* Realtime alike.
5. If a sync-cursor endpoint is ever demanded (multi-device third parties), decide tombstone
   strategy: soft-delete on `round` vs. an append-only event log — the event log doubles as the
   webhook outbox, so decide them together.

## Sources

- Codebase (read 2026-07-20): `apps/web/server/api/routers/round.ts` (:303, :778),
  `apps/web/components/billing-sync.tsx`, `apps/web/db/schema.ts` (profile :29, round :231,
  handicap_calculation_queue :534), `supabase/migrations/20251207150152_replace_handicap_trigger.sql`,
  `20251207150153_schedule_queue_processor.sql`, `20251107000000_enable_profile_realtime.sql`,
  `20260412120000_notify_round_approval_change.sql`,
  `supabase/functions/process-handicap-queue/index.ts`,
  `apps/web/app/api/webhooks/revenuecat/route.ts`.
- [Supabase Realtime — Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes) (2026-07-20)
- [Supabase Realtime — Broadcast](https://supabase.com/docs/guides/realtime/broadcast) (2026-07-20)
- [Supabase blog — Broadcast from Database](https://supabase.com/blog/realtime-broadcast-from-database)
- [Strava Webhook Events API](https://developers.strava.com/docs/webhooks/) · [Strava rate limits](https://developers.strava.com/docs/rate-limits/)
- [Garmin Health API](https://developer.garmin.com/gc-developer-program/health-api/) · [Open Wearables: Garmin push model](https://openwearables.io/blog/garmin-api-push-notifications-how-callback-sync-works)
- [Terra — Garmin integration](https://tryterra.co/integrations/garmin)
- [Svix pricing](https://www.svix.com/pricing/) (2026-07-20: free 50k msg/mo, Pro $490/mo)
- [Upstash QStash pricing](https://upstash.com/pricing/qstash) (2026-07-20: free 500 msg/day, $1/100k PAYG, retries + DLQ)
- [Standard Webhooks spec](https://github.com/standard-webhooks/standard-webhooks)
