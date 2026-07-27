# Pre-Mortem Review: two-way-sync (Option B — polling contract + Realtime accelerator)

Perspective: it is January 2027. The fitness-app integration shipped in August 2026 and has badly underdelivered. This is the incident narrative, traced back to weaknesses in the recommendation, followed by the preconditions that would have prevented it.

Verdict: **agree** — with preconditions. The failure modes below are execution failures the recommendation *invites*, not evidence the direction was wrong. Option C in v1 would have failed harder (webhooks into a consumer with no server), and Option A alone was strictly dominated. But "agree" is conditional on the must-address items; without them, this future is the likely one.

---

## What went wrong (January 2027 retrospective)

### 1. The "accelerator" became the contract, and the contract was never built

The recommendation said polling is the documented contract and Realtime is "purely additive." In practice the incentives ran the other way. The fitness app is built by the same developer with the same Supabase project credentials — so in week one, the Realtime path (copy billing-sync.tsx, subscribe to `postgres_changes` on `profile`) worked instantly in dev and felt magical. The polling fallback was stubbed as "refetch on app-open" and never given the 15s/2min post-submit loop, because with the socket up you never see the gap.

Then topic 2's auth work landed on scoped keys for the platform surface (or simply: the shared-project JWT flow got reworked when the first real third party arrived). The socket stopped authorizing. Nothing errored loudly — Realtime failure is silent, delivery is at-most-once by design — the app just went stale. Users submitted scorecards in the fitness app and the handicap index never visibly updated until a cold app restart. "Degrades gracefully to Option A" was true of the *architecture* and false of the *implementation*, because graceful degradation to a fallback that was never exercised is degradation to nothing.

**Root weakness in the rec:** it correctly names the ordering (polling = contract, Realtime = bonus) but provides no forcing function for that ordering. The cheap thing (Realtime, already-in-prod pattern, zero backend work) will be built first and the contract second unless something structurally prevents it.

### 2. The first consumer never exercised the platform, so the platform was never real

The strategic point of the fitness app was to be the first consumer of a surface that could become a third-party API. Because the Realtime path goes straight to `*.supabase.co` with a shared-project JWT — deliberately bypassing the Vercel/Cloudflare wall, the REST handlers, the rate limits, the docs — the fitness app ended up integrating with the *database*, not the *API*. When an actual third party showed up in Q4 2026 (the trigger the rec pre-committed to), we discovered the polling endpoints had no traffic history, no monitoring, an unverified Cloudflare bypass for non-browser clients, and a documented contract nobody had ever run. The webhook build then had to happen *simultaneously* with hardening the read path — the exact pile-up the phasing was supposed to avoid.

**Root weakness:** the rec treats "sidesteps the Cloudflare challenge wall" as a pro of Realtime. For the platform ambition it is also a con: the sidestep means the first consumer validates nothing about the surface third parties will actually use. (Topic 3 owns the wall, but this topic's recommendation quietly removed the only v1 traffic that would have proven the fix.)

### 3. Stale rounds, deleted-round ghosts, and mismatched indexes between apps

The rec's liveness story covers `handicapIndex` (profile is in the publication) and hand-waves the rest to "refetch on app-open." Nobody wrote down *which resources* app-open refetches. The fitness app refetched profile only. A user deleted a round on web (rounds are hard-deleted — verified: `round` has no `updated_at`, no soft-delete); the fitness app kept showing it, next to an index that no longer matched the visible rounds. Support tickets read "the two apps disagree about my handicap," which for a *handicap-tracking product* is a trust-killing bug class. The optional one-line migration to publish `round` was never done (and would have leaked DELETE events past RLS anyway — the rec's own caveat).

**Root weakness:** "plain resource reads suffice" is true per-resource but the rec never enumerated the resource set + refetch triggers that make the two apps *converge*. Convergence, not freshness, is what users actually notice.

### 4. The 2-minute polling cap encoded an unmonitored assumption

The post-submit poll (15s × ~2min) is bounded by the belief that recalc lands in 60–90s. In November a pg_cron misfire backed up `handicap_calculation_queue` for 40 minutes (prod precedent exists: this repo has already had a phantom-applied migration and a broken migrate CI — infra silently drifting is not hypothetical here). Every submission that afternoon showed "recalculating…" for 2 minutes, gave up, and displayed the *old* index with no error state. No alert existed on queue lag because the polling contract's freshness floor was assumed, never monitored.

### 5. The deferred-webhook triggers fired and nobody noticed

The open question "does the fitness app have a backend?" was never answered before build — and then the answer changed. Users wanted background "your index changed" notifications (the rec's own open question #4), so the fitness app grew a tiny push server for APNs. That is precisely trigger #3 ("fitness app growing a backend"). But triggers written in a research doc don't page anyone. Instead of the planned outbox+QStash+Standard-Webhooks build, a hand-rolled `pg_net` call to the fitness backend was added to the approval trigger — unsigned, fire-and-forget, no retries — the exact un-designed webhook system the deferral was meant to prevent, now load-bearing and undocumented.

---

## Preconditions to avoid this future

1. **Contract-first, enforced structurally.** The polling path (submit → poll → converge, from a non-browser client, through the Cloudflare bypass) must be built, integration-tested, and monitored *before* any Realtime code is written in the fitness app — and ship a recurring "socket-down" test (kill the channel, assert the app still converges). If topic 2's auth outcome is undecided, the Realtime accelerator is blocked, not the default.
2. **Answer the two gating open questions before build, not during:** (a) does the fitness app have/plan a backend (changes the whole answer — a hardcoded first-party webhook becomes the cheap path); (b) does v1 share the Supabase project. The recommendation's cheapness is conditional on both; treat them as inputs, not footnotes.
3. **Define convergence, not just freshness:** enumerate the exact resource set the fitness app refetches on app-open/foreground (profile *and* rounds list at minimum), and add alerting on `handicap_calculation_queue` lag so the 2-minute poll cap's assumption is watched. Give the "gave up polling" state an explicit UX.
4. **Make the deferral triggers operational:** a checklist item in the repo (not the research doc) that any new consumer-facing outbound HTTP call must go through the planned outbox/QStash/signing design — so the trigger firing is detected at code-review time, not in a post-mortem.

## Sharpest points

- "Degrades gracefully" is an architectural property the implementation won't have unless the fallback is built first and chaos-tested; Realtime's silent at-most-once failure mode plus a same-developer shared-project shortcut makes accelerator-becomes-contract the *default* outcome.
- Realtime bypassing Cloudflare is listed as a pro but is strategically a con: the first consumer then validates the database, not the API platform — the read path meets its first real traffic only when a third party arrives.
- The rec solves freshness for `handicapIndex` but never defines cross-app *convergence* (rounds edited/deleted on web); with hard deletes and no `updated_at`, "refetch on app-open" needs an enumerated resource set or the two apps will visibly disagree about the user's handicap.
- The 2-minute poll cap encodes an unmonitored assumption about pg_cron queue latency in a repo with prior silent-infra-drift incidents; no alert on queue lag means the failure mode is "old index shown confidently."
- Deferral triggers written in research docs don't fire; the fitness app growing an APNs backend is the likeliest trigger and the likeliest one to be met with a hand-rolled unsigned pg_net call instead of the planned build.
