# Blue Hat review — two-way-sync (process control)

**Verdict: agree** — with process conditions on how and when this decision gets locked.

## Was this the right question?

Mostly, and the research did the single most valuable process move available: it **interrogated
the question's framing instead of answering it as posed**. The topic assumed "polling = a
'changes since cursor' endpoint." The research showed that framing smuggled in a schema project
(`round` has no `updated_at`, hard deletes, so cursor ⇒ tombstones + triggers) and replaced it
with plain resource polling. That reframe is the decision — everything else follows from it.
This is exactly what a research phase is for.

One framing miss: the topic is titled "two-way-sync" but the research only decides the
handicappin→fitness direction (correctly — the write path is other topics' scope). The synthesis
step should retitle or scope-note this so nobody later believes bidirectional sync was decided
here.

## Was the method sound?

Yes, unusually so. Spot-checked and confirmed:

- Codebase claims carry file:line citations and survive verification: `profile` is in the
  realtime publication (migration `20251107000000`), no `refetchInterval` exists in
  `apps/web` or `apps/native`, the queue/cron/pg_net machinery is where the research says it is.
- External sources are primary (Supabase docs, Strava/Garmin developer docs, vendor pricing
  pages) and access-dated **today** (2026-07-20) — recency is not a concern, which matters
  because Supabase Realtime guidance (Broadcast vs Postgres Changes) moved recently and the
  research caught it.
- Options have real cons, including cons of the recommended option. Reversal triggers for the
  deferred webhook build are pre-committed. Open questions are explicit. This is the shape a
  lockable research artifact should have.

Two method nits, neither fatal:

1. **"No push can beat the 60s floor" is slightly overclaimed.** A push emitted *from*
   `process_handicap_updates` at recalc completion would notify at exactly the floor with zero
   polling — the floor bounds freshness, not the value of push. The conclusion still holds
   (polling inside the same bound is far cheaper for one consumer), but the synthesis should not
   repeat the stronger version of the claim, because it will be quoted later when the floor
   argument no longer applies (e.g. if recalc ever becomes synchronous).
2. **Anchoring on first-party UX.** "The fitness app shouldn't get better freshness than
   handicappin gives itself" treats the current first-party experience as a standard when it may
   be an accepted deficiency. It's a fine descriptive baseline; it is not a normative argument.
   Open question 3 (product sign-off on ~90s) is the correct handling — but it must actually be
   asked, not just listed.

## Process gap: two open questions were answerable before researching

Open question 1 — **does the fitness app have a backend?** — is a fact the owner can answer in
one sentence, it materially branches the answer (a hardcoded first-party webhook becomes the
cheap middle path if yes), and it was knowable before any of this research ran. Same for open
question 3 (freshness acceptance). Cheap, decisive, owner-held facts should be gathered *before*
fan-out research, not deposited as open questions after. Flag this for the orchestration process
generally, and resolve both before this topic locks.

## Decision-process prescription

1. **Lock at the right altitude.** The unconditional decision here is: *no eventing
   infrastructure in v1; plain resource polling is the documented contract; no sync-cursor
   endpoint; webhooks deferred with the stated triggers.* Lock that now — it survives every
   topic-2 outcome. The Realtime accelerator is **not part of the lockable decision**; it is a
   topic-2-contingent implementation detail. Record it as "if topic 2 = shared project, add the
   billing-sync pattern" and let topic 2's gate activate or kill it. Do not let the headline
   "Option B" make Realtime look load-bearing — Option A is the contract; B = A + a free rider.
2. **Sequencing:** this topic cannot fully close before external-auth-model (topic 2). Order the
   gate accordingly.
3. **Get two sign-offs before lock:** (a) owner answers the fitness-backend question; (b) product
   accepts "~90s while foregrounded, next-open otherwise."
4. **Make the reversal triggers observable.** "Polling rate-limit pressure" needs an owner and a
   metric (e.g. Upstash rate-limit hit counts per consumer surfaced in existing observability),
   or the trigger will never fire in practice.
5. Open question 5 (tombstone strategy vs event log doubling as webhook outbox) is a genuine
   design coupling — carry it into whichever future plan builds either one, so they're decided
   together as the research says.

## What would change the answer

- Fitness app has (or grows) a backend that stores handicap history → the hardcoded first-party
  webhook middle path re-enters; revisit before phase 2.
- Product rejects the ~90s post-submit freshness → the real change is to the recalc pipeline
  (synchronous or on-demand recalc), which is a different and bigger decision than transport —
  do not attempt to solve it with push.
- Topic 2 lands on PAT/API-key auth → strike the Realtime accelerator, ship Option A unchanged.
