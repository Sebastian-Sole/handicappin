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

## Waivers

(none yet)

## Deferred

(none yet)

## Per-state paywall evidence

(populated during cluster 8)
