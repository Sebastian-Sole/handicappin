# Synthesis: two-way-sync

**Topic:** Is polling sufficient for v1 two-way sync, or is push needed — and if push, webhooks vs Supabase Realtime?
**Research recommendation:** Option B — polling is the v1 contract, Realtime as free foreground accelerator, webhooks deferred with pre-committed triggers, no sync-cursor endpoint.
**Panel:** 7 perspectives (white hat, red hat, black hat, yellow hat, green hat, blue hat, pre-mortem).
**Verdict: CONSENSUS — Option B adopted, with one structural amendment and a set of binding conditions.**

## Vote summary

| Perspective | Verdict | Core position |
|---|---|---|
| White hat | agree | All 9 repo-internal claims verified; billing-sync already fires on the exact event of interest |
| Red hat | agree | Rejecting the cursor endpoint is the sneaky-best call; Realtime must be non-contractual |
| Black hat | **mixed** | Accelerator entrenches shared-project lock-in; billing payload leaks by default; no recalc-failed signal |
| Yellow hat | agree | Cheapest path and best-UX path coincide; layering is purely additive |
| Green hat | agree | 60–90s floor is self-imposed — on-demand queue kick collapses it to ~1–2s |
| Blue hat | agree | Lock at the right altitude: Option B is really Option A plus a topic-2-contingent rider |
| Pre-mortem | agree | Accelerator-becomes-contract is the default failure; enforce contract-first ordering |

Weighing arguments, not counting votes: the black hat does not dispute that polling suffices for one first-party-adjacent consumer, nor that webhooks are premature. Its concerns — accelerator lock-in, billing-column exposure, recalc-failure invisibility, deferred schema work — are all conditions the other six also raised in softer form. Nothing fundamental survives against the core decision.

## The locked decision

**No eventing infrastructure in v1. The sync contract is plain resource reads (REST polling) with refetch-on-foreground/after-submit semantics. Outbound webhooks are explicitly deferred behind pre-committed, operationalized triggers. No "changes since cursor" endpoint in v1.**

Structural amendment (blue hat's altitude correction, endorsed by red hat, black hat, and pre-mortem): **the Supabase Realtime accelerator is demoted from "part of the recommendation" to a conditional, undocumented, non-contractual internal optimization.** It is permitted only if topic 2 (external auth model) lands on shared-project Supabase JWTs, and the fitness app must be fully functional with the socket off. It never appears in the API documentation. The unconditional decision above survives every topic-2 outcome.

Rationale that survived adversarial review:
- The recalc pipeline is itself async on a 60s pg_cron cadence (`process_handicap_updates`, migration 20260502094814) — push cannot beat polling on freshness *given the current pipeline* (blue hat's correction noted: the floor bounds freshness, not the value of push; the case against webhooks is cost-for-one-consumer, not physics).
- handicappin's own apps live on fetch-on-navigation with zero `refetchInterval` anywhere — verified.
- `round` has no `updated_at` and is hard-deleted; a cursor endpoint silently drags in a migration + tombstone + forever-contract project. Declining it is the largest scope avoided in this topic.
- Webhook prerequisites (outbox chokepoints at `process_handicap_updates` + approval trigger, QStash vendor already in stack, Standard Webhooks signing, thin Strava-style payloads) are pre-specced as a **dated sketch, not a commitment** — re-validate vendor choice when a trigger fires (red hat: Supabase may ship native queues first).

## Binding conditions (absorbed from critical reviews)

**Before locking — owner-held facts (blue, red, white, yellow, pre-mortem all flagged; these are five-minute questions to the same developer, not research unknowns):**
1. **Does the fitness app have (or plan) its own backend?** If yes, a single hardcoded first-party pg_net hook (pattern already in prod for round approvals) re-enters as a nearly-free middle path covering edits/approvals while the app is closed.
2. **Product sign-off on the freshness contract** ("~90s while foregrounded, on next app-open otherwise"). If rejected, the fix is recalc-pipeline redesign — a different, bigger decision than transport.

**Before/while building the polling contract:**
3. **Evaluate the on-demand queue kick first** (green hat): post-submit invoke of the process-handicap-queue edge function (~10 lines, fire-and-forget) likely collapses submit-to-index latency to ~1–2s for all surfaces and changes the documented contract. Evaluate before freezing any poll-cadence numbers. Consider provisional-index-in-submit-response alongside the API-design topic.
4. **Measure actual prod recalc latency once** (white hat) so documented expectations are data, not cron-cadence inference. Prefer red hat's honest contract ("eventually consistent, typically <2 min, refetch on focus/after submit") over folklore numbers like "15s for 2min".
5. **Define failure semantics** (black hat): the consumer must be able to distinguish recalc-pending from recalc-failed (recalc marker on the round or a submission-status resource). A poll timeout rendering a stale index with no error state is a correctness hole. Add alerting on `handicap_calculation_queue` lag.
6. **Define convergence** (pre-mortem): enumerate the exact resource set refetched on app-open/foreground (profile AND rounds list, minimum), so hard-deleted rounds cannot sit next to a mismatched index.
7. **Add `updated_at` to `round` now** (black hat — trivial migration) and decide soft-delete vs append-only on paper, *before* a consumer builds against hard-deletes. This does NOT reopen the cursor endpoint; it keeps the retrofit cheap.
8. **Decide billing-column exposure** (black hat): `profile` carries plan/rounds_used/subscription_status; any profile read or Realtime subscription delivers them to the fitness app. Strip/segregate, or explicitly accept — but decide, don't drift.
9. **Verify the polling path end-to-end from a non-browser client through the Cloudflare bypass** before launch (white hat, pre-mortem) — the challenge-wall gotcha is the project's known prod hazard and the REST path must carry real traffic and monitoring from day one.

**If (and only if) the Realtime accelerator is built (contingent on topic 2 = shared project):**
10. **Contract-first ordering, enforced structurally** (pre-mortem): polling built, integration-tested, and monitored before any Realtime code lands in the fitness app; recurring socket-down test proving convergence without it.
11. **Do NOT add `round` to the `supabase_realtime` publication** without an explicit call on the DELETE-events-skip-RLS side channel (black hat).
12. **Prefer Broadcast-from-Database over `postgres_changes`** per Supabase's own steer, or justify the deviation (green hat).

**Deferral hygiene:**
13. **Operationalize the webhook triggers** (blue hat, pre-mortem): each trigger gets an owner and an observable signal (e.g. Upstash rate-limit hits per consumer), plus a review-checklist rule: any new consumer-facing outbound HTTP call must use the planned outbox/QStash/signing design — so the trigger firing is caught at code-review time instead of via a hand-rolled unsigned pg_net call.
14. **Sequencing gate:** this topic cannot fully close before topic 2 (external auth model). If topic 2 lands on PAT/API-key, formally re-ratify that Option A alone meets the product bar; the Realtime rider dies quietly rather than reading as a regression.

## Strongest surviving dissent

Black hat / pre-mortem residual position: even demoted and conditioned, building the Realtime accelerator teaches the first consumer to integrate with the database rather than the API — the REST path gets no traffic or monitoring until a real third party arrives, and shared-project JWTs in a second app's runtime make any future move to a real API boundary a breaking change for a live consumer. The safest version of this decision skips Realtime in the fitness app entirely for v1. The panel majority holds that conditions 10–12 plus the non-contractual demotion adequately contain this; it is recorded here so the topic-2 discussion weighs it deliberately.

## Cross-topic dependencies

- **Topic 2 (external auth model):** gates the Realtime rider and the challenge-wall side-benefit. This synthesis is written so the locked core survives either outcome.
- **API-design topic:** provisional-index-in-submit-response and 202-Accepted/status-resource shape (green hat) belong there, decided together with the sync contract, not after.

## Sources

- Research: `docs/research/api-platform/topics/two-way-sync/research.md`
- Panel reviews: `docs/research/api-platform/topics/two-way-sync/reviews/`
- Key verified anchors: `apps/web/server/api/routers/round.ts` (~778 pre-recalc insert; 971–983 rollback deletes), migrations 20260502094814 (cron), 20251207213412 (process_handicap_updates), 20251107000000 (profile in realtime publication), `apps/web/components/billing-sync.tsx` (postgres_changes pattern), `apps/web/db/schema.ts` (round: createdAt only, no soft delete).
