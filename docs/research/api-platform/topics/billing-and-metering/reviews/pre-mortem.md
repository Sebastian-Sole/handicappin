# Pre-mortem review: billing-and-metering

Perspective: it is January 2027. The fitness-app integration shipped in August 2026 and has badly underdelivered. This is the story of how, traced back to this recommendation, followed by the preconditions that would have prevented it.

Verdict: **mixed** — the core metering choice (Option 1) survives the pre-mortem; the failure comes from what the recommendation deferred, sequenced wrong, or glossed with "must just travel with the pipeline."

## The failure narrative

### August 2026: the provisioning step doesn't ship with the endpoint

The recommendation hung the onboarding fix on "an explicit idempotent provisioning step at account-link/consent time" — explicitly deferring the mechanism to the adjacent auth-topic decision. The auth topic chose shared-Supabase-project (both apps, same auth), which meant there *was no link screen and no consent moment*: fitness-app users were already authenticated the first time they tried to save a scorecard. The provisioning step had no home, so it slipped to "fast follow." For six weeks, every fitness-app user who had never opened handicappin — i.e., the entire target audience of the integration — hit the opaque FORBIDDEN from `round.ts:334-341` (or worse, the `.single()` failure for users with no profile row at all, since `create-profile` is only invoked by handicappin's own signup flow). The fitness app's sync feature earned a reputation as broken in its first release cycle, which is the only cycle that matters for a feature's adoption curve.

*Root cause in the rec:* correctly rejecting silent defaults in `submitScorecard`, but making the replacement mechanism a dependency on an undecided adjacent topic with no fallback hook point. "Idempotent provisioning at consent time" is a design, not a plan, when consent time may not exist.

### October 2026: background sync + retries burns lifetime quota with duplicates

The fitness app submits rounds as fire-and-forget background sync with retry-on-failure — because that is what every sync client does. The pipeline has **no idempotency key**: a timeout after commit (the submission does course auto-creation, admin email side effects, and a post-commit re-check — it is slow) means the client retries and creates a duplicate round. Each duplicate counts against the LIFETIME 25 (metering is a pure row count, `access-control.ts:39-51`) and corrupts the handicap calculation the product exists to protect. Users hit the 25-round wall at round 17. Support cannot tell duplicates from real rounds. The recommendation's machine-readable error contract covered `plan_required` and `round_limit_reached` — it never mentioned idempotency, the single most load-bearing contract feature for a sync-style consumer under lifetime metering.

*Root cause in the rec:* "zero changes to metering math" was treated as a pro. Under a retrying API client, count-based lifetime metering with non-idempotent writes is a quota-corruption machine. The metering didn't need to change; the write path did.

### November 2026: the race-rollback "travels with the pipeline" and gets worse

The rec said the post-hoc rollback (round.ts:949-992) "must just travel with the pipeline when it's extracted." It did travel — unmodified. Three problems surfaced at API traffic patterns:

1. Its error message says "Please try again" — the fitness app's retry logic obeyed, looping at the wall until rate-limited.
2. The cleanup is four sequential service-role deletes outside any transaction; a mid-sequence failure left orphaned pending-tee/course rows that the admin submission queue then surfaced as ghost submissions.
3. Concurrent web + API submission (the exact scenario an integration creates: user logs a round on the course in the fitness app while their earlier web submission is in flight) made the race re-check fire far more often than it ever did with one client.

*Root cause in the rec:* the open question "replace rollback with in-transaction check?" was filed as an open question instead of a precondition. An API launch multiplies concurrency; post-hoc delete-and-apologize is a single-client design.

### December 2026: the RLS side door makes attribution fiction

`submitted_via` shipped as a nullable column set by server code. But the round RLS insert policy still allowed any bearer token to insert via PostgREST — the "follow-up security decision" that, being a follow-up, never happened. A handful of users (and one scraper that harvested tokens from the fitness app's debug logs) inserted rounds directly: no plan gating, no limit, `submitted_via = null`. Under the also-deferred "null-as-legacy" backfill policy, abuse rounds are *indistinguishable from pre-migration legacy rounds*. The forensics column exists; the forensics are impossible. The 25-round paid wall — the business model — leaks through a door the research itself flagged.

*Root cause in the rec:* flagging the side door as a follow-up while shipping the attribution column whose value depends on that door being closed. Attribution enforced at the app layer + open DB write path = no attribution.

### Net result

The upgrade funnel the rec preserved never materialized: users who hit the wall inside the fitness app didn't follow `upgrade_url` into a product they'd never opened — they toggled sync off. Meanwhile duplicates, ghost submissions, and untraceable side-door rounds consumed the two-person team's quarter.

## Preconditions to avoid this future (the 2-3 that matter)

1. **Provisioning must have a concrete, auth-decision-independent hook and ship in the same milestone as the endpoint.** Decide NOW where `ensureProvisioned` runs if there is no link screen (e.g., an explicit one-time `POST /v1/profile/provision` the consumer must call, returning the disclosure text — still explicit, still not a silent default inside submitScorecard). If the auth topic hasn't landed by build time, this is the fallback, not a blocker.
2. **Idempotency keys and an in-transaction limit check are launch prerequisites, not open questions.** No public write endpoint over lifetime-count metering without (a) a client-supplied idempotency key deduping retries and (b) the race check moved inside the transaction (advisory lock or serializable count) so "commit then delete then say retry" never faces a machine client.
3. **Close the PostgREST insert side door before any token reaches the fitness app, and make `submitted_via` trustworthy at the data layer** (restrict the RLS policy so only the API/tRPC paths can insert; then and only then is null-as-legacy a safe backfill policy).

Secondary (should-address, not decision-blocking): add a distinct machine-readable code for the concurrent-rollback error (it is not retryable in the way the current prose implies), and instrument the `plan_required`/`round_limit_reached` error *rates* from day one — the funnel assumption (wall → upgrade) is untested for users whose only touchpoint is another app, and the lifetime-25 shape question will come back within two quarters of automatic ingestion.

## Stance on the options

Option 1 is still right — Options 2 and 3 fail faster (free-product leak; dead-on-arrival integration). The pre-mortem does not indict the metering choice; it indicts shipping Option 1 with its three hard dependencies (provisioning hook, idempotent writes, closed side door) left as deferred follow-ups.
