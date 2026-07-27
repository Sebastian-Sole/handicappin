# Black Hat Review — two-way-sync (Option B: polling contract + Realtime accelerator, webhooks deferred)

Perspective: caution and risk. Verdict: **mixed** — polling-first is defensible, but the
recommendation underprices the coupling, failure-mode, and schema-debt costs it carries.

## 1. The Realtime "accelerator" is a strategic coupling, not a free add-on

The headline of Option B — near-instant updates at zero cost — is contingent on topic 2
choosing shared-project Supabase auth. That is the tail wagging the dog in reverse: once the
fitness app opens a websocket directly to `*.supabase.co` with a handicappin Supabase JWT,
the shared-project architecture is **entrenched in a second app's runtime**. Every future
move toward a real API boundary (separate Supabase project, PAT/API keys, an actual gateway)
becomes a breaking change for a live consumer. "Nothing to un-build later" is only true of
the server; the *client-side* dependency on direct DB-adjacent access is exactly the thing
platform teams spend years clawing back. If the longer-term goal is a genuine third-party
API, Option B's accelerator teaches the first consumer to bypass the API.

Also verified: profile RLS is own-row-only (`20251011094523`, "Users can view their own
profile"), so cross-user leakage is not the issue — but postgres_changes delivers the **full
new row** on UPDATE. The profile row carries billing state (`plan_selected`, `rounds_used`,
`subscription_status`, Stripe linkage). The fitness app would receive billing payloads it
has no business consuming. That is data-boundary erosion by default, not by decision.

## 2. Two contracts, one documented — the classic silent-drift trap

The recommendation says "polling is the contract, Realtime is an accelerator." In practice,
once the fitness app's UX depends on the socket for snappiness, publication membership
(`ALTER PUBLICATION supabase_realtime ADD TABLE profile`, migration 20251107000000) becomes
load-bearing infrastructure that **no test asserts and no doc governs**. Failure modes:

- Someone drops/recreates the publication or the table (Drizzle migrations have already
  needed history repair twice in this repo's memory) and nothing fails — the fitness app
  just quietly goes stale-until-poll.
- Supabase is actively steering postgres_changes users toward Broadcast; a deprecation or
  behavior change lands on their schedule, not ours.
- At-most-once delivery + no replay means the accelerator can die mid-session (token expiry,
  channel error) invisibly. Polling masks it — until someone "optimizes" the polling cadence
  down because "Realtime handles freshness," at which point the documented contract has
  silently become the fallback nobody exercises. billing-sync.tsx survives this because web
  refetches constantly for other reasons; an external consumer won't.

## 3. Polling cannot distinguish "recalc pending" from "recalc failed" — a correctness hole

The recommended contract is: submit, then poll the profile for ~2 minutes. If the recalc
pipeline stalls (pg_cron missed runs, edge function failure, queue backlog — all real
possibilities; this repo has already seen phantom-applied migrations and a broken CI migrate
job in prod), the fitness app polls, times out, and **renders the stale pre-recalc index with
no signal that anything is wrong**. The user just submitted a scorecard and sees an unchanged
index; the natural conclusion is that the submission failed, so they resubmit. There is no
recalc-status resource in the proposed contract. First-party apps tolerate this because
"fetch on next navigation" carries no expectation; a post-submit polling loop **creates** the
expectation and then can't report failure. This needs a status answer (e.g., round row
carries a `recalculated` marker, or a submission-status endpoint) before the contract ships.

Related lock-in: documenting "index appears within ~2 minutes" externalizes the pg_cron
60-second cadence as an API behavior. Changing queue mechanics later becomes semi-breaking.

## 4. The deferral bakes in schema debt that gets strictly more expensive

The research itself concedes the trap and then walks into it: `round` has no `updated_at`,
rounds are hard-deleted (compensating deletes at round.ts:971-983), and the open questions
note the tombstone-vs-event-log decision "should be decided together" with the webhook
outbox. Deferring **both** means the schema hardens in its cursor-hostile shape while a live
consumer builds against it. When the trigger fires ("first third-party with a server"),
you'll be retrofitting `updated_at`, a delete strategy, AND an outbox under the expectations
of existing consumers — the most expensive possible sequencing. The cheap hedge is available
now: add `updated_at` to `round` (a trivial trigger migration) and pick the soft-delete vs
event-log direction on paper, without building the cursor endpoint. Costs an afternoon;
buying it later costs a migration under load.

Also: "refetch on app-open" for edits/deletes is a **full-list-diff contract**. Fine for
consumer #1; it does not survive consumer #2 with any round volume, and the recommendation
presents it as the documented contract, not a stopgap.

## 5. The transport hierarchy can invert under the Cloudflare wall

The polling path goes through the known 429 Security Checkpoint wall; the fix is a
dashboard-side bypass rule — configuration that is unversioned, unaudited, and one
well-meaning Cloudflare settings change from regressing. The Realtime socket bypasses the
wall entirely. So in the failure mode where the bypass rule breaks, the **accelerator is the
only working channel** and the "contract" is down — the exact inversion of the design's
stated hierarchy. If topic 3's solution is dashboard config, the sync design's reliability
floor is dashboard config.

## 6. Smaller sharp edges

- **DELETE events skip RLS**: if `round` is added to the publication (the "one-line
  migration"), every subscriber receives every user's round-deletion PKs. The summary waves
  this off as low sensitivity; it is still a global activity side-channel shipped to an
  external app, and precedents like this get copied. Don't publish `round` without an
  explicit decision.
- **Rate limiting**: Upstash limits were tuned for browser traffic. A 15s post-submit poll is
  fine, but app-open refetch bursts from a second app against the same per-user limits
  deserve a check before the contract promises them.

## Bottom line

Option A as the contract is sound, and deferring *platform-grade* webhooks is right. The
risks live in the two garnishes: the Realtime accelerator (coupling + billing-payload
exposure + undocumented second contract) and the "defer everything" schema posture (missing
`updated_at`/delete strategy, no failure signaling). Fix those four and Option B is
acceptable; ship it as written and the failure modes above are the realistic outcomes.
