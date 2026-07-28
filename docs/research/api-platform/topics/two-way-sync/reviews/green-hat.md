# Green Hat Review — two-way-sync

Perspective: creativity and alternatives. Verdict: **agree** with the recommendation (Option B), but the research missed the most interesting move: the problem it optimizes around is self-imposed and can largely be made to disappear.

## 1. The "60-90s freshness floor" is not physics — it's a cron line you own

The entire transport argument rests on "no push can beat the queue cadence." But the cadence is
`cron.schedule('process-handicap-queue', ...)` firing a plain HTTPS call to
`https://<project>.supabase.co/functions/v1/process-handicap-queue`
(supabase/migrations/20251207150153_schedule_queue_processor.sql, 20251207194500_update_cron_setup.sql).
That URL is invocable on demand. A fire-and-forget kick of the same edge function immediately after
`submitScorecard` enqueues (from the API handler, or a `pg_net` call in the enqueue trigger — the repo
already runs trigger→pg_net twice) collapses post-submit latency from ~60-90s to ~1-2s for EVERY
surface, including web and native, for roughly ten lines of code. The edge function is already
queue-draining and idempotent by design (it processes whatever is queued), so a duplicate cron firing
is harmless. Once submit-to-index is ~2 seconds, the polling-vs-push debate mostly evaporates: one or
two polls, or even a slightly slow synchronous response, covers the primary flow. The research treats
the floor as immovable and never considers removing it. This is the cheapest option on the table and
it was not in the option set.

## 2. Return a provisional index in the submit response

WHS recalculation is deterministic (best-8-of-20 over known differentials) and shared calc code
already exists (`supabase/functions/handicap-shared/`, mirrored in the watch app's Swift engine). The
submit endpoint could compute and return `provisionalHandicapIndex` inline, flagged provisional until
the queue confirms. The fitness app then never shows "recalculating…" at all. Zero transport work;
purely a response-shape decision for the v1 API contract (topic: API design), and it should be decided
there.

## 3. Same-developer reframe: is this an integration at all?

The fitness app is first-party. If topic 2 lands on shared-project Supabase auth, the fitness app can
read `profile.handicapIndex` exactly the way apps/native does — supabase-js select + the existing
Realtime subscription pattern. In that world there is no "sync endpoint" to design for v1; the REST
polling contract only needs to exist for the *future third party*, and could be specified but barely
built. The research gestures at this via the Realtime accelerator but still frames polling-a-REST-
endpoint as the v1 contract even for a first-party consumer that may never need it.

## 4. Smaller unconsidered alternatives

- **Broadcast-from-Database as v1 primary, not a later migration.** The research cites Supabase
  steering to `realtime.send()`/`broadcast_changes()` triggers but files it under "migration path."
  It is barely more work than adding `round` to the publication, and it erases the two caveats the
  research itself flags on postgres_changes (RLS-not-applied-to-DELETE, single-threaded scaling).
  If any Realtime work is done, start on the recommended primitive rather than the legacy one.
- **Formalize post-submit polling as `202 Accepted` + status/Location** (or a poll token) instead of
  documenting "poll every ~15s" as folklore. Same behavior, but it becomes a proper API contract that
  third parties' HTTP clients already understand — and it composes with point 1 (usually one poll).
- **APNs/FCM is dismissed too quickly.** For a mobile-only first consumer, a silent data push is the
  one transport that actually reaches the device in background — and the repo already has the
  trigger→pg_net machinery to call Expo's push API from `process_handicap_updates`. Agreed it is a
  separate feature, but it deserves a line in the deferral triggers, because for THIS consumer it is
  more relevant than webhooks.

## 5. Where I agree strongly

- Deferring webhooks with pre-committed triggers is right; the Strava/Garmin phasing evidence is apt.
- Not building a sync-cursor endpoint (no `updated_at`, hard deletes) is the correct dodge.
- Realtime-as-accelerator-with-polling-truth mirrors billing-sync.tsx and costs nothing.

## Must address

1. Evaluate the on-demand queue kick (post-submit invoke of `process-handicap-queue`) BEFORE freezing
   the "poll every 15s for 2min" contract — it likely changes the documented contract to "poll once
   after ~2s" and improves the first-party apps for free.
2. Decide the provisional-index-in-response question together with the API-design topic, not after it.
3. If Realtime is used at all, justify starting on postgres_changes rather than Broadcast-from-Database,
   given Supabase's own steer and the DELETE/RLS caveat the research documents.

Recommendation stands; it just stops one reframe short of making most of the problem vanish.
