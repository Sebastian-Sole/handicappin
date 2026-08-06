-- =============================================================================
-- Migration: G4 column-grant sweep over the remaining PostgREST-reachable
-- tables (launch gate G4, ADR-2026-07-29-launch-gates.md §5.1; plan 010 §T6).
--
-- THE INVARIANT (§5.1): for every server-owned column on a PostgREST-reachable
-- table, the column must be absent from BOTH the INSERT and the UPDATE
-- column-grant lists for the client roles. Restrictive policies govern VALUES;
-- column grants govern which columns a client may NAME at all. `round` and
-- `score` were hardened in 20260730120000 / 20260730090000; this migration is
-- the sweep over everything else PostgREST can reach.
--
-- THE TRAP (same as the two template migrations): a column-level REVOKE is a
-- NO-OP while the table-level grant is held — Postgres permits the write if
-- EITHER the table-level OR a column-level privilege matches. Every block
-- below therefore revokes the verb at TABLE level first and then re-grants
-- the allowed columns. Prod corollary: the revoke also destroys any existing
-- column grants, so revoke and re-grant must run in ONE transaction
-- (`psql -1` or `supabase db push`) or the surface is briefly wide open — or
-- permanently narrow if the re-grant fails.
--
-- Corollary for future migrations: a later bare
-- `grant insert on <table> to authenticated` (or `grant update`/`grant all`)
-- SILENTLY OVERRIDES every column grant below and re-opens the existence
-- axis. Column grants must be re-stated, never blanket-restored.
--
-- WHAT CLIENTS ACTUALLY DO (verified by repo-wide sweep of supabase-js
-- `.from("<table>")` call sites in apps/web + apps/native, excluding the
-- service-role admin client and Drizzle, which run as `postgres`/service_role
-- and are untouched by these grants):
--
--   * profile               — upsert w/ ignoreDuplicates (INSERT-only:
--                             id, email, name, verified, "handicapIndex") in
--                             app/auth/callback/route.ts and
--                             components/auth/google-sign-in-button.tsx;
--                             UPDATE of `verified` (verify-email web+native,
--                             auth callback) and `name` (auth router).
--   * email_preferences     — merge upsert of (user_id, feature_updates,
--                             updated_at) in server/api/routers/auth.ts
--                             → needs INSERT and UPDATE on those columns.
--   * pending_email_changes — SELECT + UPDATE(verification_attempts) +
--                             DELETE in app/actions/email-change.ts. All
--                             INSERTs happen in the request-email-change /
--                             cancel-email-change edge functions as
--                             service_role → clients need no INSERT at all.
--   * course, "teeInfo", hole, submissions, stripe_customers,
--     pending_lifetime_purchases, legal_consents
--                           — SELECT only (RLS-scoped). No client write path
--                             exists in the repo.
--   * otp_verifications     — server-only (edge functions, service_role); its
--                             lone policy is a deny-all. No client access.
--   * webhook_events, handicap_calculation_queue
--                           — already fully locked (20260502095010,
--                             20260502104219); restated here so the sweep is
--                             self-contained and idempotent.
--
-- SELECT and (where a permissive delete policy exists and is used) DELETE are
-- deliberately left alone, matching 20260730090000: narrowing read columns is
-- a separate change with its own compatibility surface. `anon` keeps SELECT
-- where it holds it today (app/about/page.tsx counts rows with the bare anon
-- key; RLS already scopes what it can see).
--
-- §5.1 TRAP 2 (relational ownership / EXISTS-against-parent) does NOT apply
-- to any table this migration leaves writable: `profile` rows are keyed by
-- auth.uid() itself, and `email_preferences` / `pending_email_changes` carry
-- no client-supplied foreign key to a parent row. The tables that DO carry
-- client-suppliable FKs (`submissions`.roundId/courseId/teeId) lose the write
-- verbs entirely, which closes the existence axis outright — stronger than a
-- value policy. No uuid-pattern-to-text-column carry-over occurs here.
--
-- PROD APPLY (by hand — the migrate workflow is broken; see
-- docs/research/api-platform/plans/003-notes.md):
--   * Apply transactionally (`psql -1` or `supabase db push`).
--   * Post-deploy: verify via anon-key PostgREST probes + a prod DUMP of
--     information_schema.column_privileges — NOT via migration history
--     (shot-level-stats lesson: phantom "applied" row, DDL never ran).
--     Re-runnable probe: scripts/g4-grant-sweep-probe.ts.
-- =============================================================================

-- Fail fast rather than queueing behind a long transaction: the REVOKEs below
-- take ACCESS EXCLUSIVE locks on their tables.
set local lock_timeout = '5s';

-- ── 1. Read-only reference data: course / "teeInfo" / hole ──────────────────
--
-- All three are course-catalogue tables written exclusively by the server
-- (Drizzle ingestion + submissions lifecycle). Their only policy is an
-- authenticated SELECT, so RLS already blocks client writes on the value
-- axis; these revokes close the existence axis as well, so the invariant
-- survives a future permissive policy being added by mistake.
revoke insert, update, delete on public.course from authenticated, anon;
revoke insert, update, delete on public."teeInfo" from authenticated, anon;
revoke insert, update, delete on public.hole from authenticated, anon;

-- ── 2. submissions ──────────────────────────────────────────────────────────
--
-- Client surface is SELECT-only (server/api/routers/round.ts lists the
-- caller's own submissions; the moderation queue runs on the admin client).
-- Rows are created by the server-side submission lifecycle. `roundId`,
-- `courseId`, `teeId`, `status`, `resolvedAt`, `rejectionReason` are all
-- server-owned; with no write verbs there is no column list to curate.
revoke insert, update, delete on public.submissions from authenticated, anon;

-- ── 3. Billing tables: stripe_customers / pending_lifetime_purchases ────────
--
-- Both are written only by Stripe webhook handlers and server code (Drizzle /
-- service_role). Clients read stripe_customers (stripe router:
-- select stripe_customer_id) and may read their own pending purchases; SELECT
-- stays. A client-writable billing table is exactly the class of hole G4
-- exists to close.
revoke insert, update, delete on public.stripe_customers from authenticated, anon;
revoke insert, update, delete on public.pending_lifetime_purchases from authenticated, anon;

-- ── 4. legal_consents ───────────────────────────────────────────────────────
--
-- Consent rows are appended by server code (record-consent route via Drizzle,
-- create-profile edge function as service_role). Clients may view their own
-- consents (SELECT policy); they must not be able to write, rewrite, or
-- delete an audit trail.
revoke insert, update, delete on public.legal_consents from authenticated, anon;

-- ── 5. Server-only tables: no client access at all ──────────────────────────
--
-- otp_verifications holds OTP hashes, attempt counters and request IPs; every
-- reader/writer is an edge function using service_role, and its only policy
-- is a deny-all. webhook_events and handicap_calculation_queue were already
-- locked by 20260502104219 / 20260502095010 — restated so this sweep is the
-- single self-contained statement of the invariant (revoking an absent
-- privilege is a no-op, not an error).
revoke all privileges on public.otp_verifications from authenticated, anon;
revoke all privileges on public.webhook_events from authenticated, anon;
revoke all privileges on public.handicap_calculation_queue from authenticated, anon;

-- ── 6. profile ──────────────────────────────────────────────────────────────
--
-- THE BIG ONE. Before this migration `authenticated` held full-table INSERT
-- and UPDATE on profile, and the permissive own-row policies let every one of
-- these through over PostgREST for the caller's own row:
--   PATCH { plan_selected: 'lifetime', subscription_status: 'active' }
--   PATCH { billing_version: 999 }        (JWT billing-cache invalidation)
--   PATCH { "handicapIndex": 1.0 }        (the computed handicap itself)
-- i.e. a full self-service billing bypass and handicap forgery, one curl
-- away. No app code ever used those write paths.
--
-- 6a. INSERT — exactly the first-party OAuth-signup upsert payload
-- (ignoreDuplicates:true → ON CONFLICT DO NOTHING, so NO update privilege is
-- implied by the upsert):
--   * id               — the caller's own auth.uid(); the INSERT policy's
--                        WITH CHECK is stated in terms of it.
--   * email, name      — provider-supplied identity at first sign-in.
--   * verified         — set from the provider's email_verified claim.
--   * "handicapIndex"  — the explicit 54 default the signup path writes.
-- EXCLUDED — everything else, notably every billing column (plan_selected,
-- plan_selected_at, subscription_status, current_period_end,
-- cancel_at_period_end, billing_version, billing_provider),
-- "initialHandicapIndex" (server-derived baseline) and "createdAt"
-- (column default). Fail-safe: any future profile column is NOT insertable
-- by clients until a migration explicitly extends this list.
revoke insert on public.profile from authenticated, anon;
grant insert (
  id,
  email,
  name,
  verified,
  "handicapIndex"
) on public.profile to authenticated;

-- 6b. UPDATE — the two columns first-party code actually edits:
--   * name     — profile edit (server/api/routers/auth.ts).
--   * verified — email-verification flows (web + native verify-email, auth
--                callback).
-- EXCLUDED — id (immutable key), email (owner-decision: email changes go
-- through the OTP flow's admin client only — app/actions/email-change.ts
-- documents this), "handicapIndex" (computed by the handicap engine, not
-- user-editable), and every billing column, same list as 6a.
revoke update on public.profile from authenticated, anon;
grant update (
  name,
  verified
) on public.profile to authenticated;

-- profile SELECT and DELETE are left as they stand: SELECT is the app's main
-- read surface (own row via RLS), DELETE has an own-row permissive policy and
-- the restrictive OAuth deny from 20260728091000 layered on top.

-- ── 7. email_preferences ────────────────────────────────────────────────────
--
-- The auth router merge-upserts (user_id, feature_updates, updated_at) with
-- onConflict=user_id, which PostgREST compiles to
-- INSERT ... ON CONFLICT DO UPDATE SET <payload columns> — so the same three
-- columns are needed on BOTH verbs. EXCLUDED: id (identity/serial) and
-- created_at (column default).
revoke insert on public.email_preferences from authenticated, anon;
grant insert (
  user_id,
  feature_updates,
  updated_at
) on public.email_preferences to authenticated;

revoke update on public.email_preferences from authenticated, anon;
grant update (
  user_id,
  feature_updates,
  updated_at
) on public.email_preferences to authenticated;

-- DELETE keeps its table-level grant: an own-row permissive DELETE policy
-- exists and delete has no column axis to narrow.

-- ── 8. pending_email_changes ────────────────────────────────────────────────
--
-- Rows are created ONLY by the request-email-change edge function
-- (service_role), so clients get no INSERT despite the (now unreachable)
-- permissive INSERT policy — privileges are checked before policies.
revoke insert on public.pending_email_changes from authenticated, anon;

-- UPDATE — the OTP verifier increments its own attempt counter
-- (app/actions/email-change.ts). token_hash, new_email, old_email,
-- expires_at, cancel_token are all server-owned: a client able to rewrite
-- new_email or token_hash could hijack the email-change flow outright.
revoke update on public.pending_email_changes from authenticated, anon;
grant update (
  verification_attempts
) on public.pending_email_changes to authenticated;

-- SELECT and DELETE stay: the verifier reads its own pending row and deletes
-- it when it has expired, both RLS-scoped to user_id = auth.uid().
