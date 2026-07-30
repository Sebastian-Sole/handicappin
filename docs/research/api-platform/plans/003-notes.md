# 003 — W3 workstream notes (bundled migration)

**Date:** 2026-07-29 · **Migration:** `supabase/migrations/20260729100000_round_natural_key_and_api_columns.sql`

## Prod duplicate scan (C2) — result

Run against a production **dump** via the session pooler (not migration history — Ballerud
lesson; not direct IPv6). Result: **CLEAN.**

- Collisions under `(userId, teeTime)`: **0**
- Collisions under `(userId, teeId, teeTime, nine_hole_section)`: **0**
- `teeTime` distribution: all values are real **minute-precision wall-clock timestamps** —
  no date-only-midnight rows exist in prod (no fitness-app backfill has happened yet).

## Natural key + teeTime window (C2/C6) — specification

- Key: **strict** `UNIQUE NULLS NOT DISTINCT ("userId", "teeId", "teeTime", nine_hole_section)`,
  applied directly with **no cleanup/dedup step** (scan was clean).
- `NULLS NOT DISTINCT` because 18-hole rounds store `nine_hole_section = NULL`; with the
  Postgres default two identical 18-hole rounds would never collide. Front/back 9-hole pairs
  at the same `teeTime` remain distinct (C2's false-409 hazard).
- `teeTime` semantics pinned: minute-precision wall-clock timestamp (what web/native already
  write). **No sanity window is enforced in the key** (C6): historical fitness-app backfill of
  date-only rounds is legitimate and must not be blocked. If a backfill source emits date-only
  midnight timestamps, two same-day 18-hole rounds on the same tee would collide on the natural
  key — the **externalId idempotency key is the primary dedupe** for that path (DECISIONS #6),
  and 005's replay/conflict semantics (below) make the collision non-destructive.

## Idempotency (DECISIONS #6)

`"externalId" text NULL` + `UNIQUE("userId", "externalId")` (NULLS DISTINCT — web/native rows
carry NULL). Replay-by-lookup; 005's `POST /v1/rounds` implements the replay.

## Identical-body duplicate semantics (sub-decision) — DECIDED

- **Same `(userId, externalId)`, identical body → `200` with the existing round**
  (Terra/Stripe-success style; a retrying background-sync client must converge, not error).
- **Same `externalId`, different body → `409`** (RFC 9457; the client has a bug or reused a key).
- **Natural-key collision without an externalId match → `409`** with a problem body that
  includes the existing round's id (same-key-different-body is a real conflict; reserve 409
  for it).
- 005 encodes these in the `/v1` error mapper + OpenAPI; this file is the source for that
  encoding.

## Soft-delete vs append-only for `round` — DECIDED on paper

**Keep hard-delete for v1.** Rationale:

- The v1 sync contract (006) is **full-snapshot polling** — consumers refetch the complete
  rounds list, so a deleted round disappears from the snapshot and cannot sit next to a
  mismatched index, **provided** the convergence set is honored: on app-open/foreground a
  consumer refetches **profile AND the rounds list together** (two-way-sync condition 6).
- Append-only is rejected: users legitimately delete mistaken rounds, and GDPR erasure
  requires hard deletion anyway.
- `updated_at` (added in this migration, trigger-maintained) keeps the retrofit cheap: if an
  incremental cursor endpoint is ever reopened, adding `deleted_at` (soft-delete tombstones)
  becomes a prerequisite **at that time** — no consumer may build against hard-deletes plus a
  cursor. This does not reopen the cursor endpoint (declined, two-way-sync #7).

## `submitted_via` (billing-and-metering #4)

Nullable text, **analytics/attribution only** (self-reported; no client registry). NULL = row
predates the column. Day one the API path writes effectively `api:fitness`. No `api_clients`
registry until a real third-party consumer exists.

## `quarantined` (billing gate — CLOSED)

`boolean NOT NULL DEFAULT false`. Written by 002 Part B's in-transaction check (not in this
subplan). Excluded in this subplan from **every counting/handicap site**:

- free-tier count: `apps/web/utils/billing/access-control.ts` (`.eq("quarantined", false)`)
- billing-facing round count: `round.getCountByUserId`
  (`apps/web/server/api/routers/round.ts`) — native consumes it as its quota gate
  (profile screen, rounds/add, live setup) and the web homepage as totalRounds
- the post-commit race re-check in
  `apps/web/server/services/scorecard/submit-scorecard.ts` (must count the same population
  as the primary gate, or a divergence deletes a legitimate committed round)
- handicap computation: `supabase/functions/process-handicap-queue/index.ts` rounds fetch,
  the established-handicap count inside `submit-scorecard.ts`, and its second copy in
  `scorecard.getScorecardByRoundId` (`apps/web/server/api/routers/scorecard.ts`).

`approvalStatus` (course-data moderation) is a different axis and was not overloaded.

## Column-privilege hardening (review fix round — IN the migration)

The review's security pass verified over PostgREST that the permissive "Users can update
their own rounds" policy + the table-level UPDATE grant let an authenticated user PATCH any
column of their own rows — including `quarantined` (future billing bypass) and
`approvalStatus` (a **live pre-existing hole**: self-approving rounds into the handicap
computation past moderation). The migration now:

**Two axes, deliberately hybrid.** Writes to `round` are constrained by two mechanisms with
different granularity, and both are needed:

| Axis | Mechanism | Question it answers | Right for |
|---|---|---|---|
| Existence | column GRANTs | may the client *name* this column at all? | columns with **no** benign client value — `externalId`, `submitted_via`, `updated_at`, `id`, `createdAt` |
| Value | restrictive INSERT policy | may the client send it carrying *this value*? | columns that **do** have one — `quarantined` (`false`), `approvalStatus` (`'pending'`) |

So `quarantined`/`approvalStatus` stay insertable (the policy vets their values — a normal
client write legitimately carries them, and one test asserts explicit `'pending'` succeeds),
while `externalId`/`submitted_via` are not insertable at all.

**The trap** (why every block revokes at table level first): a column-level REVOKE is a
**no-op while the table-level grant is held** — Postgres allows the write if EITHER the
table-level OR a column-level privilege matches. `revoke update ("quarantined")` alone
changes nothing. Demonstrated during verification: re-granting table-level INSERT re-opened
the squat even with all 20 column grants still in place.

Not done with a BEFORE INSERT trigger: a trigger enumerates columns in its body so it would
not auto-cover future columns, and silent normalisation is harmful on an API surface — a
client would send an idempotency key, have it nulled, and get a 201 believing the key was
registered. A loud 42501 is the correct failure mode.

The migration:

- revokes table-level UPDATE from `authenticated`/`anon` and re-grants **`notes` and nothing
  else**. A bare `REVOKE UPDATE (col)` is a NO-OP while a table-level grant exists —
  Postgres checks table OR column privilege — hence revoke-at-table-level-then-regrant.
  Fail-safe: future columns are non-updatable by `authenticated` until the grant is extended
  in a migration. Rationale in **The UPDATE grant is `notes` only** below.
- revokes table-level INSERT and re-grants **per column** (20 columns: the gameplay/rating
  set + `notes` + `userId` + `quarantined` + `approvalStatus`). **Non-insertable result:
  `createdAt`, `externalId`, `id`, `submitted_via`, `updated_at`.** This closes an
  **idempotency-key squat**, reproduced end-to-end: a user pre-inserts a fabricated round
  carrying the key a connected app will deterministically derive
  (`externalId: 'fitbull-workout-123'`, `submitted_via: 'api:fitness'`, 58 strokes, −30.0
  differential) → 201. The app's replay-by-lookup on `(userId, externalId)` then resolves to
  the **fabrication** — so a `200` "your round is stored" is returned for a round the app
  never wrote, making the 005 contract promise falsifiable — or on the other branch its
  genuine round hits `round_userId_externalId_key` and **409s forever** on a deterministic
  key. The fabricated row also carried `submitted_via = 'api:fitness'`, i.e. **forged
  provenance** indistinguishable from a genuine API submission, which is unacceptable in a
  handicap product with an active official-handicap workstream. (005's plan flagged this
  class of gap at its line 17.) Both columns are now server-written only — 005's `/v1`
  handlers write them as the table owner and bypass these grants.
- adds ONE RESTRICTIVE INSERT policy —
  `quarantined = false and "approvalStatus" <> 'approved'` — because column privileges do
  **not** constrain INSERT payloads (verified: inserts carrying `quarantined: true` *or*
  `approvalStatus: 'approved'` both succeeded under grants alone). Closing only the UPDATE
  side left self-approval wide open on INSERT: verified end-to-end that a user could submit
  their own unmoderated tee (rated 99.9/155), `POST` a pre-approved round against it, get
  201, and match the handicap-processor filter with a −21.9 score differential having never
  passed moderation. `round` has no BEFORE INSERT trigger normalising `approvalStatus`, so
  the policy is the control.
- Integration-tested as a real signed-in user: PATCH `quarantined`/`approvalStatus`/
  `externalId` → 42501; PATCH `teeTime`, `nine_hole_section`, `teeId`, `scoreDifferential`,
  `course_rating_used`, `totalStrokes` → 42501 (each also asserting the stored value did not
  move); a `notes`-only PATCH → 200, with the `updated_at` trigger firing and `createdAt`
  untouched; INSERT with `quarantined: true` → 42501; INSERT with
  `approvalStatus: 'approved'` → 42501; both at once → 42501; INSERT naming `externalId` →
  42501, `submitted_via` → 42501, both → 42501; legitimate insert (defaults) and explicit
  `'pending'` insert → 201, with `externalId`/`submitted_via` NULL. Each denial was proven
  real by reverting the relevant grant/policy and watching exactly that assertion fail (and
  nothing else) — for all six UPDATE denials the reverted run reported
  `expected undefined to be '42501'`, i.e. the write had succeeded outright.

## The UPDATE grant is `notes` only (review fix round 2) — DECIDED

The re-granted UPDATE column list started at 17 columns (the gameplay/rating set + `notes`).
A review flagged that as too wide, and it was — for a reason worth writing down, because the
reasoning generalises to every table this API surface touches.

**The invariant that makes the grant unnecessary:** `round` is server-written. No client code
in `apps/web/**` or `apps/native/**` issues a PostgREST UPDATE against `round` — every
`.from("round")` call site is a SELECT, plus one account-deletion DELETE. Every legitimate
round write (`submitScorecard`, the moderation approval flow, `process_handicap_updates`,
002 Part B's quarantine check, 005's `/v1` handlers) runs server-side as the `postgres` table
owner through Drizzle or as `service_role`, and bypasses column grants entirely. The 17-column
grant bought **no functionality at all**; it was pure surface.

**Why the excluded columns are the server's to write:**

| Group | Columns | Why |
|---|---|---|
| Durable inputs to the handicap computation | `teeTime`, `nine_hole_section`, `teeId`, `courseId`, `holes_played`, `parPlayed` | `teeTime` fixes a user's round ORDERING and the index is derived from a 20-round sliding window over it; `nine_hole_section` selects the front-vs-back rating, slope and par for a 9-hole round (`supabase/functions/handicap-shared/timeline.ts`). A client-authored value re-derives a **different, internally self-consistent** `profile.handicapIndex` with nothing erroring. |
| Derived outputs | `scoreDifferential`, `adjustedGrossScore`, `adjustedPlayedScore`, `courseHandicap`, `existingHandicapIndex`, `updatedHandicapIndex`, `exceptionalScoreAdjustment` | Computed and rewritten by the recompute; `profile.handicapIndex` is only ever written by `process_handicap_updates`. A client value is noise until the next recompute, and misleading until then. |
| Ratings audit record | `course_rating_used`, `slope_rating_used` | Not inputs to the recompute (it reads live tee ratings), so nothing ever rewrites them — a client edit persists indefinitely as a falsified record of how the round was rated. |
| Already excluded | `quarantined`, `approvalStatus`, `externalId`, `submitted_via`, `updated_at`, `userId`, `id`, `createdAt` | See the two-axes note above. |

`notes` is the only `round` column with a plausible direct-edit affordance: free text the
player authored, read back only to the player, input to no computation. So it is the whole
grant.

**Threat model note.** Every one of these writes is scoped to the user's OWN rows by the
permissive `auth.uid() = "userId"` UPDATE policy — there is no cross-user exposure here. That
is not a mitigation: in a product with an official-handicap workstream, a user forging their
own index **is** the threat. "Only your own rows" is the definition of the problem, not a
bound on it.

**What this closes and what stays open.** This closes the **UPDATE half** of the previously
open "tee ratings recorded on the round are client-writable" item. The **INSERT half remains
open**: 6b still grants INSERT on `course_rating_used`/`slope_rating_used` (and on the
gameplay and derived-output columns), because a first-INSERT posture decision is genuinely
harder — a client write path that legitimately creates rounds has to supply *something*, and
which side of the wire computes it is the open question. Deliberately **not** decided here;
carried to 008's hardening checklist.

**Generalised rule for 008.** Before granting a column privilege, ask whether any client code
actually exercises it. If none does, the grant is surface with no upside — do not grant it,
and let the fail-safe (no grant → no write) carry future columns too.

**Why this is safe for first-party writes.** `submitScorecard` runs through Drizzle as the
`postgres` table owner, which bypasses RLS entirely, so the policy never applies to it. Its
own moderation invariant is independent and unchanged: `resolvedApprovalStatus` starts from
the client's value but is forced to `'pending'` on every new-tee, edited-tee, and
own-pending-tee branch, and the only branch that preserves a client-supplied `'approved'`
requires the tee to resolve to an existing **approved, non-archived** row (otherwise
`CourseResolutionError`). So an approved round can only ever reference a moderated tee. The
moderation approval flow and 002 Part B likewise run as service paths.

First-party server writes are unaffected (Drizzle connects as the `postgres` table owner);
`service_role` keeps its own grants.

## Duplicate-submission surfacing (review fix round)

A double submit (double-click, watch sync replay, native offline retry) previously leaked
the raw Postgres constraint message to the UI banner. The service now maps 23505 on either
round dedupe key to a typed `DuplicateRoundError` (natural-key vs external-id), and the
tRPC adapter maps it to `CONFLICT` with user-facing copy. 005's REST adapter reuses the
same error per the duplicate semantics above (identical-body → 200-replay; the CONFLICT
maps the same-key-different-body 409 arm).

## Prod apply checklist (migrate workflow is broken — this runs BY HAND)

> **ORDERING — apply and verify in prod BEFORE this PR is merged, not after.**
>
> Merging to `main` auto-deploys web code that queries the new `quarantined` column. If the
> column is not there yet:
>
> - `round.getCountByUserId` (`apps/web/server/api/routers/round.ts`) **throws** on the query
>   error → the homepage round count and native's quota gate break outright;
> - `apps/web/utils/billing/access-control.ts` fails **OPEN** on error and reports "0 rounds
>   used" to every free-tier user → a silent **quota bypass**, which is worse than the loud
>   failure because nothing pages anyone.
>
> The `process-handicap-queue` edge function must likewise be deployed **only after** the
> migration is live — it filters on `quarantined`, and it is deployed **manually** (there is
> no functions deploy workflow), so nothing enforces this for you. A missing column there
> means every queued handicap job fails through the retry path to `MAX_RETRIES`.
>
> Sequence: **migration → verify against a prod dump → merge PR → deploy the edge function.**

1. `select version();` — NULLS NOT DISTINCT requires PG **>= 15** (local 15.x governs local
   only; confirm prod).
2. Apply **transactionally** (`psql -1` or `supabase db push`) so a partial run can never
   leave columns without constraints/grants. The file's `set local lock_timeout = '5s'`
   only takes effect inside a transaction (the CLI warns 25P01 and no-ops it when applying
   non-transactionally — another reason `psql -1` is required).
3. Idempotency is **partial, and that is fine for a single transactional apply.** The
   `ADD COLUMN`s use `IF NOT EXISTS`; the policy is recreated via
   `drop policy if exists` + `create policy`. The two `ADD CONSTRAINT`s sit in DO blocks that
   swallow `duplicate_object` — but **re-adding an existing UNIQUE constraint actually raises
   `duplicate_table` (42P07)** from its backing index, not `duplicate_object` (42710), so
   those blocks do **not** make a re-run succeed. (The idiom was borrowed from
   `20260501001627_add_round_nine_hole_section.sql`, where the constraints are CHECKs and
   `duplicate_object` **is** the right handler.) Consequence: a second run aborts loudly and,
   because of step 2, rolls back whole — a safe failure, not a partial apply. Do not treat
   "re-run to be sure" as a no-op.
4. Post-deploy: verify the DDL via a prod **dump** (information_schema /
   `pg_constraint` / `pg_policy` over the session pooler), not migration history —
   shot-level-stats lesson. Verified locally against the live local DB on 2026-07-30
   (columns incl. `updated_at timestamptz`, both constraints, trigger, restrictive INSERT
   policy, and `information_schema.column_privileges` showing `authenticated` with UPDATE on
   **`notes` only** and no table-level UPDATE grant for `authenticated`/`anon`).

### Lock duration — accepted, because `round` is small

Both `ALTER TABLE ... ADD CONSTRAINT ... UNIQUE` statements **build their unique index while
holding ACCESS EXCLUSIVE on `round`**, so the table is unavailable for the whole scan-and-
build, not merely for the moment of locking. `set local lock_timeout = '5s'` bounds only lock
*acquisition* — it does not cap how long the index build then holds that lock. Accepted as-is:
prod `round` is small enough that the build is sub-second. The scale-out alternative is
`CREATE INDEX CONCURRENTLY` followed by `ADD CONSTRAINT ... USING INDEX`, and it is
**incompatible with this checklist**, because `CONCURRENTLY` cannot run inside a transaction
block while step 2 requires the entire apply to be one transaction. Anyone repeating this
shape against a large table must pick one or the other: single-transaction safety, or a
concurrent build with a multi-step (non-atomic) apply.

## Open items / risks carried forward

- **Quarantined rounds still SURFACE in the UI** — round lists and stats
  (`round.getAllByUserId`, `round.getBestRound`, `scorecard.getAllScorecardsByUserId`,
  homepage `influencesHcp` labeling) do not filter or badge `quarantined = true` rows. They no
  longer count toward quota or handicap, but a quarantined round renders like any other.
  Two concrete consequences once Part B starts writing `quarantined = true`, both documented
  here and deliberately **not** fixed in this subplan:
  - **`round.getBestRound`** orders by `scoreDifferential` with no quarantine filter, so a
    quarantined round — one that contributes nothing to the index — can be returned and shown
    as the user's **best round**.
  - **`round.getCountByUserId` now excludes quarantined rounds, but `getAllByUserId` does
    not**, and the homepage fetches both together (`components/homepage/home-page.tsx`),
    passing the count as `totalRounds` into `transformRoundsToActivities` to number round
    milestones while the activity rows come from the unfiltered list. So the total describing
    the list is computed over a **different population** than the list itself — the count
    is billing-correct and the rows are not. Splitting the billing count from a display count
    (or filtering the display queries) is the fix; which one is the **002 Part B**
    hide-vs-badge decision, since that determines whether quarantined rounds belong to the
    display population at all.

  Hide-vs-badge remains a **002 Part B decision** (deliberately not made here).
- **`updated_at` churn vs a future sync cursor (006 must know):**
  `process_handicap_updates` rewrites `updatedHandicapIndex` across a user's whole round
  history on every recompute, so the trigger mass-bumps `updated_at` on all those rows
  after each submission. Any 006 cursor built on `updated_at` will therefore full-re-sync a
  user's history per submission — fine for polling-snapshot v1, but a real cursor needs
  either a separate column or trigger suppression for the recompute path.
- **No DB-level free-tier quota enforcement:** a direct PostgREST INSERT bypasses the tRPC
  limit check entirely (verified 201 as an authenticated user). The free-tier limit is
  application-layer only today. Explicit open item for 002 Part B / 008 (launch gates) —
  recorded as fact, not assumption.
- **`submitted_via` / `externalId` are now fully server-written** — neither insertable nor
  updatable by `authenticated`. My earlier framing (that spoofing them was
  acceptable-by-design because they are "attribution/idempotency, not authorization") was
  **wrong** and the review corrected it: `externalId` is load-bearing for the 005 contract's
  replay-by-lookup, and `submitted_via` is provenance in a sports-integrity product.
  **Generalised lesson for 008's hardening checklist:** for every sensitive column, reason
  about existence-vs-value separately and about INSERT and UPDATE separately — a column
  gated on one verb is not gated on the other. This PR had the same hole in two doors twice
  (`approvalStatus` UPDATE then INSERT; then `externalId`/`submitted_via` INSERT).
