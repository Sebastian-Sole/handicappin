# 003 — W3: The bundled migration (natural-key index + externalId + submitted_via + updated_at + quarantine)

**Workstream:** W3 (Checkpoint B) · **Status:** PENDING · **Billing-gated:** No
**Depends on:** the **prod duplicate scan** (OWNER/infra, blocking); co-designed with 002 (W1).
**Blocks:** 002 Part B (accept-and-quarantine needs the `quarantined` column), 005 (W4 write path), 006 (W5 sync convergence).

---

## Goal

Write the **single** migration that carries five coupled changes to the `round` table. Four are locked by DECISIONS #9; the fifth (`quarantined`) is added here because the closed billing gate's accept-and-quarantine behavior needs a column and the one-migration principle keeps them together:

1. **natural-key unique index** on `round` (incl. `nineHoleSection`; pinned `teeTime` semantics),
2. **`externalId`** with `UNIQUE(userId, externalId)` (idempotency, DECISIONS #6),
3. **`submitted_via`** (nullable; attribution, can never be backfilled),
4. **`updated_at`** on `round` (sync retrofit stays cheap),
5. **`quarantined`** (boolean, default false; the accept-and-quarantine flag — DECISIONS §Billing gate — CLOSED).

**The migration cannot be written until the prod duplicate scan runs** — against a dump, not migration history (Ballerud lesson).

## Background

The `round` table today has **zero unique constraints**, no `updated_at`, no `externalId`, no `submitted_via`, and `teeTime` is a bare `timestamp().notNull()` with no timezone (confirmed `apps/web/db/schema.ts:231-311`). Every write path (web, native, watch, API) is unprotected against duplicates, and the API path will add a background-sync client that retries slow submissions — under lifetime row-count metering each duplicate burns quota and corrupts the handicap record. A natural-key unique index protects all paths at once (yellow hat called it "a gift to the whole product"), but the key as originally proposed — `(userId, teeId, teeTime)` — is miscalibrated: it omits `nineHoleSection` (which would false-409 legitimate front/back 9-hole pairs), and `teeTime` semantics are unpinned (browser wall-clock rounded to the minute on web vs date-only midnight timestamps from fitbull's historical backfill → legitimate same-day collisions). The idempotency mechanism is **locked** as externalId-primary (`UNIQUE(userId, externalId)`, replay-by-lookup), which is what unblocks this migration to proceed now.

Two changes are coupled to sync (topic 7): `round` has no `updated_at` and is hard-deleted today, so a "changes since cursor" endpoint would silently drag in a migration + tombstone + a forever-contract; that endpoint is declined, but `updated_at` is added now so the retrofit stays cheap, and the soft-delete-vs-append-only question for `round` is decided **on paper** here before a consumer builds against hard-deletes.

The fifth column (`quarantined`) exists because the billing gate closed on **accept-and-quarantine**: over-limit API rounds are stored but excluded from handicap and from the free-tier count, and unlocked on upgrade. The round table has no field expressing that axis — `approvalStatus` (pending/approved) is course-data moderation, a different concern, and must not be overloaded. Adding `quarantined` here (rather than in a later migration) keeps the "one migration" discipline and lets 002's in-transaction check write the flag as soon as this lands. Both counting sites — the free-tier count (`apps/web/utils/billing/access-control.ts:39-51`) and the handicap timeline recompute — must be updated in this workstream to exclude `quarantined = true` rows, or quarantine leaks quota and pollutes the index.

Follow migration-history discipline: no phantom "applied" rows, and verify the DDL actually ran against prod via a dump, not migration history (the shot-level-stats lesson, where prod history showed an "applied" row the DDL never executed and every submission 500'd).

## Scope (files/areas)

- **Pre-work (blocking):** scan a **prod dump** (session pooler per the IPv6 gotcha — direct IPv6 fails; not migration history) for existing natural-key collisions. The same query resolves `(userId, teeTime)` vs `(userId, teeId, teeTime, nineHoleSection)` with real data. (OWNER/infra — see OWNER section.)
- `apps/web/db/schema.ts` (`round` table, `:231-311`):
  - Add the **natural-key unique index** incl. `nineHoleSection` (scorecard C2), with the `teeTime` granularity/window pinned per the scan.
  - Add **`externalId` text** + `UNIQUE(userId, externalId)` (DECISIONS #6; replay-by-lookup).
  - Add **`submitted_via` text nullable** (null = pre-column legacy only).
  - Add **`updated_at` timestamp**.
  - Add **`quarantined` boolean not null default false** (accept-and-quarantine flag).
- **Migration** under `supabase/migrations/` (Drizzle-generated; latest existing is `20260716121000_fix_ballerud_yellow_tee_ratings.sql`). Follow migration-history discipline.
- `apps/web/utils/billing/access-control.ts:39-51` — exclude `quarantined = true` from the free-tier count.
- Handicap timeline / `handicap_calculation_queue` consumers — exclude `quarantined = true` from the index computation (coordinate with 002).
- `apps/web/types/supabase.ts` — regenerate via `pnpm gen:types` (never hand-edit).

## Step-by-step

1. **Run the prod duplicate scan** (OWNER/infra) and record results in this workstream's notes: how many existing rows collide under `(userId, teeTime)` vs `(userId, teeId, teeTime, nineHoleSection)`, and the `teeTime` value distribution (minute-rounded wall-clock vs date-only midnight).
2. From the scan, **specify the natural key and the teeTime window** so legitimate same-day rounds (and historical date-only backfill) don't false-409. Size the key/window explicitly (C6).
3. Edit `apps/web/db/schema.ts` to add all five changes to `round`.
4. Generate the Drizzle migration into `supabase/migrations/`. Review the SQL by hand — one migration, all five changes, no phantom rows.
5. Update `access-control.ts:39-51` and the handicap timeline consumers to exclude `quarantined = true`.
6. Decide **soft-delete vs append-only** for `round` on paper (sync convergence depends on it; `round` is hard-deleted today). Record the decision in this workstream's notes.
7. Decide **identical-body duplicate semantics**: 200-with-existing-round vs 409 (green hat argues 200 with the existing round beats 409 for retry loops; reserve 409 for same-key-different-body). Encode the chosen semantics so 005's `POST /rounds` and the docs agree.
8. `pnpm gen:types`; `pnpm check:schema-sync`.
9. Integration test against local Supabase: duplicate insert → unique violation → replay path returns the existing round; quarantined round excluded from count + handicap.
10. **Post-deploy:** verify the DDL ran via a prod **dump**, not migration history.

## Binding conditions (verbatim)

From **scorecard-write-semantics §3**:

> **C2 — Prod duplicate scan + natural-key re-specification BEFORE the migration.** Scan a prod **dump** (not migration history — Ballerud lesson; session pooler per IPv6 gotcha) for existing natural-key collisions; include `nineHoleSection` in the key; pin teeTime granularity/timezone/date-only-backfill semantics. The same query resolves the (userId,teeTime) vs (userId,teeId,teeTime) question with data.

> **C6 — teeTime sanity window sized for historical backfill** — fitness-app import of old rounds is a headline v1 benefit; an over-tight window quietly kills it.

> **Sub-decision:** duplicate response semantics — green hat argues **200 with the existing round** on an identical-body duplicate (Terra/Stripe-success style) beats 409 for retry loops; reserve 409/conflict for same-key-different-body. Cheap to decide alongside Q2.

From **two-way-sync** conditions:

> 7. **Add `updated_at` to `round` now** (black hat — trivial migration) and decide soft-delete vs append-only on paper, *before* a consumer builds against hard-deletes. This does NOT reopen the cursor endpoint; it keeps the retrofit cheap.

> 6. **Define convergence** (pre-mortem): enumerate the exact resource set refetched on app-open/foreground (profile AND rounds list, minimum), so hard-deleted rounds cannot sit next to a mismatched index.

From **billing-and-metering** conditions:

> 2. **Idempotency is a launch prerequisite, not an open question.** A background-sync client retrying a slow submission creates duplicate rounds; under lifetime row-count metering each duplicate burns quota and corrupts the handicap record. Add an `external_id` (or `submission_meta` jsonb) dedupe key with a per-user+client unique index **in the same migration as `submitted_via`**.

> 4. **`submitted_via` is rescoped to analytics/attribution only** until a client registry exists and the side door is closed — it is self-reported and worthless for forensics or kill-switches before then. Null semantics decided now: null = pre-column legacy rows only, which is only a safe backfill policy once condition #1 is met. Day one the value is effectively hardcoded `api:fitness`; say so, and defer the `api_clients` registry until a real third-party consumer exists.

From **DECISIONS #9** (the bundle) and **§Billing gate — CLOSED** (a quarantined round is a distinguishable status, not an error): the `quarantined` column is added to this bundle so 002's in-transaction check can write it.

## OWNER (infra — blocks the migration)

- [ ] **Run the prod duplicate scan** against a production **dump** (session pooler, not direct IPv6; not migration history). Return the collision counts under both candidate keys and the `teeTime` value distribution so the agent can size the natural key + backfill window.

## Non-goals

- A "changes since cursor" / sync-cursor endpoint — explicitly declined; `updated_at` keeps the retrofit cheap but does not reopen it.
- Any `api_clients` registry — deferred until a real third-party consumer exists; `submitted_via` is analytics-only, effectively `api:fitness` day one.
- Changing web/native over-limit behavior — the `quarantined` column is written by the API path (002 `"quarantine"` policy); web keeps reject (web-hardening cutover is a separate gate).
- Promoting `strokes>=1` / `putts+penalties<=strokes-1` into the shared zod schema (scorecard Q3 split out; API-side enforcement lives in 005).

## Definition of done

- Prod scan results recorded; natural key + teeTime window specified against real data.
- Migration adds all five changes in one file; `pnpm check:schema-sync` clean; `pnpm gen:types` regenerated.
- `quarantined` excluded from the free-tier count (`access-control.ts`) and the handicap computation.
- Identical-body duplicate semantics decided (200-with-existing-round vs 409) and encoded consistently with 005.
- Soft-delete-vs-append-only for `round` decided on paper.
- Post-deploy: DDL verified via prod dump, not migration history.

## Verification commands

```bash
pnpm check:schema-sync   # schema/migration drift
pnpm gen:types           # regenerate apps/web/types/supabase.ts (do not hand-edit)
pnpm test:integration    # duplicate insert → unique violation → replay returns existing round; quarantine excluded from count/handicap
pnpm lint
```
