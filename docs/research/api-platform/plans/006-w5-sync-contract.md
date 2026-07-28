# 006 — W5: Sync — polling contract + queue-kick + optional webhook

**Workstream:** W5 · **Status:** PENDING · **Billing-gated:** No (billing-column exposure decision only)
**Depends on:** 003 (W3 `updated_at`), 005 (W4 read endpoints exist). Realtime rider only depends on 004 (W2) — but Realtime is out of v1, so not on the critical path.
**Blocks:** 007 (W6 fitbull notes).

---

## Goal

Ship plain REST reads as the **contract** (polling + refetch-on-foreground/after-submit); evaluate the ~10-line post-submit queue-kick; optionally add the first-party pg_net → Convex HTTP webhook (shared secret, hardcoded, **non-contractual**) since fitbull has a backend. No eventing infrastructure in v1; no "changes since cursor" endpoint.

## Background

The recalc pipeline is itself async on a ~60s pg_cron cadence (`process_handicap_updates`), so push cannot beat polling on freshness given the current pipeline — the case against webhooks is cost-for-one-consumer, not physics. handicappin's own apps already live on fetch-on-navigation with zero `refetchInterval`. A "changes since cursor" endpoint is declined because `round` had no `updated_at` and is hard-deleted (003 adds `updated_at` to keep the retrofit cheap without reopening the cursor). So the v1 sync contract is plain resource reads with refetch-on-foreground/after-submit semantics, with an honest freshness statement backed by a measured number.

Supabase Realtime is **demoted** to a conditional, undocumented, non-contractual internal optimization — permitted only if 004 lands on shared-project Supabase JWTs (it lands on separate identities + linkage, so the Realtime rider effectively dies), and fitbull must be fully functional with the socket off. It never appears in the API docs. The green-hat queue-kick — a post-submit fire-and-forget invoke of the `process-handicap-queue` edge function (~10 lines) — likely collapses submit→index latency to ~1–2s, but the real prod recalc latency must be **measured first** (Sentry traces are 100%-sampled) before any poll-cadence numbers or the `handicapRevision:"pending"` resolution wording freeze.

Two correctness holes must close: the consumer must distinguish **recalc-pending from recalc-failed** (a poll timeout rendering a stale index with no error state is a correctness hole), and `handicap_calculation_queue` lag needs alerting. And the `profile` read carries plan/rounds_used/subscription_status — that billing-column exposure must be decided (strip / segregate / explicitly accept), not drifted.

## Scope

- **Polling contract** documented against the 005 `GET /v1/profile` + `GET /v1/rounds` reads. No cursor endpoint. Enumerate the exact **convergence refetch set** (profile **and** rounds list, minimum) so a hard-deleted round can't sit next to a mismatched index.
- **Queue-kick evaluation:** post-submit fire-and-forget invoke of `process-handicap-queue` (~10 lines). **Measure real prod recalc latency first** (Sentry, 100%-sampled) before freezing any poll-cadence numbers or the pending-resolution wording.
- **Failure semantics:** consumer must distinguish recalc-pending from recalc-failed (marker on the round or a submission-status resource); add `handicap_calculation_queue` lag alerting.
- **Optional webhook (evaluate, not mandatory):** first-party pg_net → Convex HTTP action, shared hardcoded secret, Standard-Webhooks-style signing, **non-contractual forever** for external consumers. Realtime stays out of v1.
- **Billing-column exposure decision:** `profile` carries plan/rounds_used/subscription_status — strip, segregate, or explicitly accept in `GET /v1/profile` (coordinate with 005).

## Step-by-step

1. Pull the measured prod recalc latency from Sentry (100%-sampled). Record the p50/p95.
2. Decide and document the freshness contract in honest terms (e.g. "eventually consistent, typically <Ns, refetch on focus/after submit") — data, not folklore.
3. Enumerate the convergence refetch set (profile + rounds list, minimum) and document it.
4. Evaluate the queue-kick against the measured latency; either build the ~10-line fire-and-forget invoke or explicitly defer it with the measured number recorded.
5. Add the recalc-pending vs recalc-failed marker (on the round or a submission-status resource) and wire `handicap_calculation_queue` lag alerting.
6. Resolve the billing-column exposure in `GET /v1/profile` (strip/segregate/accept) with 005.
7. Evaluate (not necessarily build) the pg_net → Convex webhook; if built, Standard-Webhooks signing + hardcoded shared secret, marked non-contractual.

## Binding conditions (verbatim from two-way-sync)

> 3. **Evaluate the on-demand queue kick first** (green hat): post-submit invoke of the process-handicap-queue edge function (~10 lines, fire-and-forget) likely collapses submit-to-index latency to ~1–2s for all surfaces and changes the documented contract. Evaluate before freezing any poll-cadence numbers.
> 4. **Measure actual prod recalc latency once** (white hat) so documented expectations are data, not cron-cadence inference. Prefer red hat's honest contract ("eventually consistent, typically <2 min, refetch on focus/after submit") over folklore numbers like "15s for 2min".
> 5. **Define failure semantics** (black hat): the consumer must be able to distinguish recalc-pending from recalc-failed (recalc marker on the round or a submission-status resource). A poll timeout rendering a stale index with no error state is a correctness hole. Add alerting on `handicap_calculation_queue` lag.
> 6. **Define convergence** (pre-mortem): enumerate the exact resource set refetched on app-open/foreground (profile AND rounds list, minimum), so hard-deleted rounds cannot sit next to a mismatched index.
> 8. **Decide billing-column exposure** (black hat): `profile` carries plan/rounds_used/subscription_status; any profile read or Realtime subscription delivers them to the fitness app. Strip/segregate, or explicitly accept — but decide, don't drift.

If (and only if) the Realtime accelerator is built (contingent on 004 = shared project — which it is not):

> 10. **Contract-first ordering, enforced structurally**: polling built, integration-tested, and monitored before any Realtime code lands in the fitness app; recurring socket-down test proving convergence without it.
> 11. **Do NOT add `round` to the `supabase_realtime` publication** without an explicit call on the DELETE-events-skip-RLS side channel.
> 12. **Prefer Broadcast-from-Database over `postgres_changes`** per Supabase's own steer, or justify the deviation.

Deferral hygiene:

> 13. **Operationalize the webhook triggers**: each trigger gets an owner and an observable signal (e.g. Upstash rate-limit hits per consumer), plus a review-checklist rule: any new consumer-facing outbound HTTP call must use the planned outbox/QStash/signing design.

## Non-goals

- Any "changes since cursor" / sync-cursor endpoint — declined.
- Supabase Realtime in the fitbull v1 integration — out of v1; non-contractual forever for external consumers. (The Realtime rider is dead because 004 landed on separate identities, not a shared project.)
- A 202/polling submission resource — the write is synchronous 201 (005).

## Definition of done

- Polling contract + convergence refetch set documented; honest freshness statement backed by measured latency.
- Queue-kick decision recorded (built, or explicitly deferred with the measured number).
- recalc-pending vs recalc-failed distinguishable; `handicap_calculation_queue` lag alert live.
- Billing-column exposure in profile reads decided (not drifted).

## Verification commands

```bash
pnpm test:integration   # submit → poll → convergence (index matches after recalc); profile read does not leak un-decided billing columns
pnpm lint
pnpm test:unit
```

Measured prod recalc latency recorded (from Sentry) before doc numbers freeze.
