# Billing Implementation Log

Running record for the cross-platform billing goal
(docs/billing-implementation-handoff.md): every decision made under the
autonomy protocol (§0b), every waiver, anything deferred. D-numbering
continues from docs/native-implementation-log.md (starts at D22).

## Decisions

### D22 — Shared SKU/plan constants live in a new source-only workspace package (2026-06-12)

**What:** `packages/billing-core` (`@handicappin/billing-core`), modeled 1:1
on `@handicappin/handicap-core` (source-entry TS package, no build step).
Holds the D-products SKU constants (`com.handicappin.premium.yearly`,
`com.handicappin.unlimited.yearly`, `com.handicappin.lifetime`), the
SKU↔plan mapping, RC entitlement identifiers, the subscription-group id,
and the plan tier ranking (lifetime > unlimited > premium > free) used by
the precedence rules.

**Why:** the handoff requires the mapping in ONE module used by webhook
mapping, runbook, and native code. The apps cannot import each other
(native log D1 — colliding `@/*` aliases), so "one module" must be a
workspace package; handicap-core proves the pattern works in both the
Next and Metro bundlers.

**Alternatives rejected:** duplicating constants per app (drift risk —
exactly what the ledger forbids); putting them in `packages/handicap-core`
(wrong domain); putting them web-side only (native can't import).

### D23 — Out-of-order cursor rides webhook_events (provider + event_time_ms) (2026-06-12)

**What:** the per-provider out-of-order guard (DoD #3) needs the timestamp
of the last APPLIED event per (user, provider). Two nullable columns were
added to the existing `webhook_events` table — `provider`
('stripe'|'apple') and `event_time_ms` — plus a partial index
`(user_id, provider, event_time_ms) WHERE status='success'`. The guard
reads `max(event_time_ms)` over success rows; the cursor advances on every
successfully EVALUATED event (even ones that lose precedence and don't
change the projection), because a newer evaluated fact from a provider
makes every older fact from that provider obsolete regardless of who won.

**Why:** the handoff mandates "idempotency via the existing webhook_events
table" and an out-of-order guard, but provides no storage for the cursor.
Extending the table the idempotency already lives in keeps one
system-of-record for webhook processing state. Existing Stripe rows stay
NULL — Stripe handler ordering semantics are explicitly unchanged
(DoD #4 "updated minimally").

**Alternatives rejected:** a dedicated cursor table (more schema surface
for the same data); deriving order from the projection (impossible —
CANCELLATION/UNCANCELLATION don't move period_end, so only event time
orders them); profile-side last_event columns (claims/profile shape is
frozen beyond billing_provider).

**Backfill note:** existing paid profiles were backfilled
`billing_provider='stripe'` (Stripe is the only provider that has ever
billed this app); free/plan-less profiles stay NULL.

## Waivers

(none yet)

## Deferred

(none yet)

## Per-state paywall evidence

(populated during cluster 8)
