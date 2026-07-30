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

## Write-privilege hardening (review fix rounds — IN the migration)

The review's security pass verified over PostgREST that the permissive RLS policies + the
table-level grants let an authenticated user INSERT rounds and PATCH any column of their own
rows — including `quarantined` (future billing bypass), `approvalStatus` (a **live
pre-existing hole**: self-approving rounds into the handicap computation past moderation), and
the handicap computation's own inputs. **Final posture: `round` is server-written** — no
INSERT for client roles, UPDATE on `notes` only.

**Two axes.** Privileges and policies answer different questions, and the second is retained
even though the first now does all the work:

| Axis | Mechanism | Question it answers | Role here |
|---|---|---|---|
| Existence | privileges (table + column GRANTs) | may the client use this verb / name this column at all? | **the live control** — no INSERT at all, UPDATE on `notes` only |
| Value | restrictive INSERT policy | may the client send a column carrying *this value*? | **defense in depth** — unreachable today; the backstop if INSERT is ever re-granted |

Privileges cannot express a value constraint, which is why the policy exists at all; the
policy cannot express "no INSERT ever", which is why the revoke exists. Keeping both means
neither a careless re-grant nor a payload trick is sufficient on its own.

**The trap** (why every block revokes at table level first): a column-level REVOKE is a
**no-op while the table-level grant is held** — Postgres allows the write if EITHER the
table-level OR a column-level privilege matches. `revoke update ("quarantined")` alone
changes nothing. Demonstrated during verification: re-granting table-level INSERT re-opened
the squat even with all 20 column grants still in place. The converse also holds and is
relied on: `REVOKE <verb> ON <table>` cascades to every column-level privilege for that verb,
which is what makes a bare `revoke insert` complete.

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
- **revokes INSERT outright, with no re-grant** (`revoke insert on public.round from
  authenticated, anon`). Rationale in **INSERT is revoked outright** below. Fail-safe:
  there is no grant list to keep in sync, so future columns are non-insertable by default.
- **keeps ONE RESTRICTIVE INSERT policy** —
  `quarantined = false and "approvalStatus" <> 'approved'` — as **defense in depth**, not as
  the live control. Column privileges do **not** constrain INSERT payload values (verified:
  under a grant, inserts carrying `quarantined: true` *or* `approvalStatus: 'approved'` both
  succeeded), so a grant alone could never have been the whole answer. The hole it guards was
  verified end-to-end before the fix: a user could submit their own unmoderated tee (rated
  99.9/155), `POST` a pre-approved round against it, get 201, and match the
  handicap-processor filter with a −21.9 score differential having never passed moderation.
  `round` has no BEFORE INSERT trigger normalising `approvalStatus`, so the policy is the
  only value-level control if INSERT is ever re-granted.
- Integration-tested as a real signed-in user (18 tests): PATCH
  `quarantined`/`approvalStatus`/`externalId` → 42501; PATCH `teeTime`, `nine_hole_section`,
  `teeId`, `scoreDifferential`, `course_rating_used`, `totalStrokes` → 42501 (each also
  asserting the stored value did not move); a `notes`-only PATCH → 200, with the `updated_at`
  trigger firing and `createdAt` untouched; **every** authenticated INSERT → 42501, including
  a fully well-formed payload and explicitly-benign `approvalStatus: 'pending'` /
  `quarantined: false`, with a follow-up count proving nothing landed; and the restrictive
  policy exercised on its own by temporarily re-granting column-level INSERT inside one test,
  asserting a self-approved and a pre-quarantined insert are refused **with a
  `row-level security policy` message** (distinguishing a policy refusal from a privilege
  refusal — both are 42501) while a pending insert succeeds, then revoking again in a
  `finally`. Each denial was proven real by reverting the relevant grant/policy and watching
  exactly that assertion fail and nothing else — every reverted run reported
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

**What this closes.** This closed the **UPDATE half** of the previously open "tee ratings
recorded on the round are client-writable" item. The INSERT half was left open at the time
pending a posture decision — it is now closed too; see the next section.

**Generalised rule for 008.** Before granting a column privilege, ask whether any client code
actually exercises it. If none does, the grant is surface with no upside — do not grant it,
and let the fail-safe (no grant → no write) carry future columns too.

## INSERT is revoked outright (owner decision, 2026-07-30) — DECIDED

`round` is **server-written. PostgREST is a read surface for it.** The whole decision follows
from counting the write paths:

| Path | Real? | Runs as |
|---|---|---|
| User logs a round in the app (`submitScorecard`) | yes | `postgres` table owner, via Drizzle |
| Connected app logs a round through `/v1` (005's handlers) | yes, once built | `postgres` table owner, server-side |
| A client role INSERTs straight into the table over PostgREST | **no — never was** | `authenticated`/`anon` |

Two of the three are real and neither touches these grants. The third was never a supported
path and no code in `apps/web/**` or `apps/native/**` has ever used it. So it is closed:

```sql
revoke insert on public.round from authenticated, anon;
```

**Stated as an explicit revoke on purpose.** The same practical effect is reachable by leaving
the NOT NULL columns out of a grant list and letting nullability do the refusing — but that
hides the decision inside an accident of the schema, where adding a column default or a new
nullable column silently re-opens the door. Same discipline as the UPDATE block: say what is
meant, so the next reader can tell intent from side effect.

**The restrictive policy (6c) stays, as a second layer.** It is unreachable today —
privileges are checked before policies, so an authenticated insert is refused on privilege
before the policy is evaluated. It is kept because the failure mode it guards is realistic and
one line wide: a future migration (or a Supabase-side default-privilege sweep) that
blanket-restores `grant insert on public.round to authenticated` re-opens the whole table at
once. That is exactly what the table-level-grant trap makes easy. If that happens, the policy
is what still refuses a pre-approved or pre-quarantined round. Tested independently of the
grant — see the integration-test bullet above.

**Unaffected:** the `postgres` table owner and `service_role` keep their own INSERT
privileges, so `submitScorecard`, the moderation approval flow, `process_handicap_updates`,
002 Part B and 005's `/v1` handlers are all untouched. The permissive "Users can insert their
own rounds" RLS policy remains on the table but is now dead code for client roles.

**Note on `REVOKE` semantics** (relied on by both 6a and 6b, and confirmed live):
`REVOKE <verb> ON <table> FROM <role>` removes the table-level privilege **and** cascades to
every column-level privilege for that verb. That is what makes revoke-then-regrant work, and
it is also why a stray column grant cannot survive a table-level revoke.

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
3. **The file is idempotent — a re-run is a genuine no-op.** Verified by applying the whole
   file twice against the local DB, each time in one transaction: both runs completed and
   the second reported no errors. `ADD COLUMN` uses `IF NOT EXISTS`; the policy is recreated
   via `drop policy if exists` + `create policy` (no exception handler needed, and none is
   used); the trigger via `drop trigger if exists` + `create trigger`; the function via
   `create or replace`; grants and revokes are naturally idempotent.

   This was **not** true until 2026-07-30 and the fix is worth knowing. Both `ADD CONSTRAINT`
   DO blocks caught only `duplicate_object` (42710), but `ADD CONSTRAINT ... UNIQUE` builds a
   backing index named after the constraint, and on a re-run it is that **index** name that
   collides first — raising `duplicate_table` (**42P07**, `relation "..." already exists`),
   which the handler never caught. A re-run aborted on the first constraint. The idiom had
   been transplanted from `20260501001627_add_round_nine_hole_section.sql`, where the
   constraints are **CHECK**s — no backing index, so 42710 is the only thing they can raise
   and `duplicate_object` alone is correct *there*. Both handlers are now
   `when duplicate_table or duplicate_object then null`. Generalised: a UNIQUE/PRIMARY KEY
   constraint needs `duplicate_table`; a CHECK/FOREIGN KEY constraint needs
   `duplicate_object`; catching both is the safe default.
4. Post-deploy: verify the DDL via a prod **dump** (information_schema /
   `pg_constraint` / `pg_policy` over the session pooler), not migration history —
   shot-level-stats lesson. Verified locally against the live local DB on 2026-07-30:
   columns incl. `updated_at timestamptz`, both constraints, the trigger, and —
   - `information_schema.column_privileges`: `authenticated` has **UPDATE on `notes` only**
     and **no INSERT on any column**; `anon` has neither. Both roles retain SELECT (25
     columns) and REFERENCES, which is expected.
   - `information_schema.table_privileges`: INSERT and UPDATE on `round` are held **only** by
     `postgres` and `service_role`.
   - `pg_policy` + `pg_get_expr`: the restrictive INSERT policy is present with
     `polpermissive = false`, `polcmd = 'a'`, role `authenticated`, and with-check
     `((quarantined = false) AND ("approvalStatus" <> 'approved'::text))`.

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
- ~~**No DB-level free-tier quota enforcement:** a direct PostgREST INSERT bypasses the tRPC
  limit check entirely (verified 201 as an authenticated user).~~ **CLOSED 2026-07-30 by
  mechanism, not by policy:** `authenticated`/`anon` hold no INSERT on `round` at any
  granularity, so there is no longer a client-reachable path that creates a round without
  passing through `submitScorecard`'s limit check. Be precise about the scope of the claim:
  - What is closed is the **client-role side door**. Every round a client can cause to exist
    now goes through server code that performs the check.
  - The **table owner (`postgres`) and `service_role` are unaffected** — they retain INSERT and
    bypass RLS entirely. Anything running with those credentials (the seed loader, admin
    scripts, service paths, 002 Part B) can still create rounds without a limit check, by
    design. This is *not* a database-level quota **constraint**; nothing stops a server bug
    from over-inserting.
  - The limit itself is still enforced in application code. The change is that application
    code is now the only reachable path, which is what the open item was actually about.
- **`submitted_via` / `externalId` are now fully server-written** — neither insertable nor
  updatable by `authenticated`. My earlier framing (that spoofing them was
  acceptable-by-design because they are "attribution/idempotency, not authorization") was
  **wrong** and the review corrected it: `externalId` is load-bearing for the 005 contract's
  replay-by-lookup, and `submitted_via` is provenance in a sports-integrity product.
  **Generalised lesson for 008's hardening checklist:** for every sensitive column, reason
  about existence-vs-value separately and about INSERT and UPDATE separately — a column
  gated on one verb is not gated on the other. This PR had the same hole in two doors twice
  (`approvalStatus` UPDATE then INSERT; then `externalId`/`submitted_via` INSERT).

## Carry-forward: three stale statements in the frozen `/v1` contract (fix on PR #174)

`005-phase0-contract.md` lives on `api-platform/005-phase0-contract` and was **not** edited
from this branch — the contract is frozen and owned there. Three of its statements are now
factually stale because of this migration and need correcting on **PR #174**. Line numbers are
against `005-phase0-contract.md` as of commit `a601774`.

1. **§249 — "the RLS insert side door recorded as a shipping gate" is CLOSED.** The paragraph
   states that the same OAuth token can `INSERT` directly into `round` via PostgREST and that
   such a row lands `quarantined = false`, active for counting, having never passed the limit
   check — and that closing this door "remains a precondition for the token-bearing consumer
   going live." That precondition is met: `authenticated`/`anon` hold no INSERT on `round`.
   The quarantine guarantee no longer needs to be stated as a property of the `/v1` path only;
   it now holds for every client-reachable path, because `/v1` is the only client-reachable
   write path.
2. **§256 — "Net residual, unchanged in substance" is no longer a residual.** It says a direct
   PostgREST INSERT "still creates a round that never passed the limit check and lands
   active-for-counting. That is the shipping-gate item." There is no such INSERT any more. The
   paragraph's own caveat ("003 is under active hardening, so anyone acting on this paragraph
   should re-read the branch") is what applies here.
3. **§162 — the 409 rule's stated rationale is wrong, though the rule itself is fine.** It
   justifies treating post-hoc body divergence as a genuine conflict on the premise that
   "Rounds are editable after creation (by the user in the web app, and by the OAuth token
   itself via PostgREST, where `round` UPDATE remains open for the non-protected columns)."
   **Both halves of that premise are false.** Verified on this branch:
   - *No round-edit flow exists anywhere.* `round`'s tRPC router has five queries plus
     `submitScorecard`; there is no `updateRound`/`editRound` procedure, and the only Drizzle
     `.update(round)` in `apps/web/**` is inside an integration test. Nothing in
     `apps/native/**` either. A user cannot "correct a score in the handicappin UI" — the
     example sequence the paragraph gives cannot happen today.
   - *The PostgREST half is now definitively false.* UPDATE is `notes`-only, so no compared
     field is client-writable over PostgREST.

   **The `409 idempotency_conflict` rule is unaffected and should stay.** Its conclusion even
   survives on a narrower, still-true premise: `notes` **is** a compared field (§157) and is
   the one column still client-writable over PostgREST, so a `notes` PATCH can genuinely make
   a resubmitted body diverge from the stored round. That is the accurate version of "the
   comparison is against mutable state" — one field, not "the non-protected columns". And the
   asymmetry argument in the same paragraph (a spurious 409 costs a log line; an identity-only
   200 costs a round) stands on its own regardless. Note for whoever edits this: do **not**
   substitute "the recompute rewrites derived fields" as the justification — §162 already
   excludes handicap outputs and server metadata from the comparison, so the recompute cannot
   cause divergence.

4. **Bonus, same pass: §253 is now imprecise.** It describes the UPDATE hardening as "a
   column-level `grant update (...)` whose list **excludes** `quarantined`, `approvalStatus`,
   `externalId`, `submitted_via`, and `updated_at`." Still technically true, but the grant is
   now `notes` and nothing else, which is a much stronger statement than "excludes those
   five" — and §253's framing invites the reader to assume the gameplay and rating columns are
   still writable. Worth tightening while touching the other three.
