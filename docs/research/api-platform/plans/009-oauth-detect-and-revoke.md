# 009 — OAuth detect-and-revoke fast-follow (auto-revoke + toggle watchdog)

**Workstream:** W2 fast-follow · **Status:** PENDING · **Billing-gated:** No
**Depends on:** PR #167 merged (subplan 004 build — done 2026-07-29); OWNER enablement of the OAuth server on the hosted project (the job is a safe no-op before that).
**Blocks:** nothing. Explicitly **NOT a blocker for launch** — DECISIONS §Sign-off calls it "NEW, own PR — NOT a blocker for #167".

---

## Goal

Build the **detective control** accepted in the updateUser sign-off (DECISIONS.md, owner, 2026-07-29). Two scheduled jobs:

1. **Auto-revoke** — a pg_cron job (every minute) that detects password-change and email-change activity on users holding an active OAuth session (`auth.sessions WHERE oauth_client_id IS NOT NULL`), revokes the OAuth grant, and alerts. This collapses the accepted 24h residual window (leaked `client_id` token can change the password with no reauth within 24h of original consent) to **minutes-to-detection**. Detection uses **two signals** (see Background — the audit log alone cannot express email changes): the `user_updated_password` audit action, and a snapshot-compare of `auth.users` email-change columns.
2. **Toggle watchdog** — a daily GitHub Actions cron that reads the hosted project's auth config via the Supabase Management API and alerts if **secure password change** (`security_update_password_require_reauthentication`) or **secure email change** (`mailer_secure_email_change_enabled`) is no longer `true` — distinguishing "flipped off" from "returned null". These two settings are the whole defense; guard against silent dashboard drift.

Neither job is a preventive control. **No preventive lever exists** — GoTrue mutates `auth.users` over its own privileged connection (`supabase_auth_admin`), invisible to RLS/triggers at `updateUser` time (see `004-updateuser-decision.md` "Why no code-level deny was shipped"). This plan detects and revokes; it does not attempt to prevent, and must not drift into inventing a preventive mechanism.

## Background

Spike criterion (vi) proved an OAuth-client access token works directly against GoTrue: `updateUser({ user_metadata })` succeeds, and password/email-change requests are accepted (`plans/004-spike-results.md`). The owner accepted the residual with two load-bearing prod settings verified ON (secure password change, secure email change) and commissioned this fast-follow. The attack is **self-signaling** (a password change lands in the audit log), the window is **non-renewable**, and email change is double-confirmed. All GoTrue behavior below is verified against **GoTrue v2.183.0** (the version the local stack actually runs; the spike doc's "v2.184.0" note does not match the verified binary — every claim here was proven on v2.183.0).

**Why two detection signals (verified against GoTrue v2.183.0 source + local stack):**

- `user_updated_password` is the **only** clean audit signal. It fires exactly on password updates.
- `user_modified` fires **unconditionally on every successful `PUT /auth/v1/user`** (`internal/api/user.go:266`, nil traits — the payload carries no discriminator for *what* changed). Empirically: `updateUser({data})` → `['user_modified']`; `updateUser({password})` → `['user_updated_password','user_modified']`. Matching `user_modified` would make the job **self-triggering**: an OAuth client's own benign metadata write (the exact op the spike proved works) would revoke its own grant, and first-party traffic trips it too — `apps/web/app/api/auth/refresh-claims/route.ts:46` calls `updateUser({ data: { last_claims_refresh } })` after checkout, so any fitbull-connected user completing checkout would be revoked. **The watch list is exactly `('user_updated_password')`. Never match `user_modified`.**
- **v2.183.0 has NO email-change audit action at all** (`internal/models/audit_log_entry.go:24-47`); both the email-change request leg and the confirmation legs emit only `user_modified` (`user.go:266`, `verify.go:419`, `verify.go:585`). Email-change detection therefore cannot come from the audit log; it comes from **snapshot-comparing `auth.users` email-change columns** (below) — read-only against auth-owned tables, with all state in `public`.

**The real revocation mechanism (located, primary sources):** GoTrue's user-facing revocation is `DELETE /auth/v1/user/oauth/grants?client_id=<uuid>` — surfaced in supabase-js (pinned 2.95.3) as `supabase.auth.oauth.revokeGrant({ clientId })` (`GoTrueClient._revokeOAuthGrant`). Its documented semantics: "marks consent as revoked, deletes active sessions for that OAuth client, and invalidates associated refresh tokens"; it additionally writes a `token_revoked` audit entry with payload `{"oauth_client_id": …, "action": "revoke_oauth_grant"}` (`internal/api/oauthserver/handlers.go:622`). The spike measured post-revoke `getUser` failure at ~47 ms (criterion iii). **But it is user-JWT-scoped** — it authenticates with the user's own live access token, which a scheduled job does not have. **No admin equivalent exists in GoTrue v2.183.0**: `GoTrueAdminApi.oauth` is client CRUD only (`/admin/oauth/clients` list/create/get/update/delete/regenerate_secret — verified in auth-js 2.95.3 dist). Therefore the job replicates `revokeGrant`'s effects directly in SQL — **empirically proven end-to-end on the local stack** (real OAuth session minted, the SQL below run verbatim, tokens invalidated):

- `auth.oauth_consents(user_id, client_id, …, revoked_at)`, `UNIQUE (user_id, client_id)` — revocation = `SET revoked_at = now()`. Note: **re-consent UN-revokes the same row** (`internal/models/oauth_consent.go:158` sets RevokedAt back to nil) rather than inserting a new one.
- `auth.sessions.oauth_client_id uuid` (indexed: `sessions_oauth_client_id_idx`) — delete the rows;
- `auth.refresh_tokens.session_id` FK is **ON DELETE CASCADE** → refresh tokens die with the session;
- **audit-trail parity (decided: replicate):** the job also INSERTs the `token_revoked` audit entry GoTrue itself would write (the `postgres` role has INSERT on `auth.audit_log_entries`), with the payload shape copied from a real `revokeGrant` observed on the local stack, so Supabase-side audit tooling sees job revocations exactly like user-initiated ones. This is a data insert, not DDL. Safe against self-trigger: the watch list matches only `user_updated_password`.

Server-side token validation goes through GoTrue's `getUser` network check (`getUserFromBearerToken` in `apps/web/server/api/trpc.ts`), so deleting the session invalidates the access token within milliseconds. The JWKS caveat from criterion iii stands: a consumer validating locally via cached JWKS would silently miss revocation; we never do that for external tokens.

**Existing cron vehicles in this repo** ("both ride the existing cron" — sign-off):

- **pg_cron + pg_net + Vault** — `process-handicap-queue` runs every minute via `cron.schedule` → `net.http_post`, secret from `vault.decrypted_secrets` at tick time (`supabase/migrations/20251207150153_schedule_queue_processor.sql`, hardened in `20260430120000_secure_queue_cron_with_secret.sql`). Also plain-SQL daily jobs (`20251211151609_cleanup_expired_email_changes.sql`). Runs in prod today.
- **GitHub Actions cron** — `ingress-canary.yml` (*/15, Slack webhook alert step, `workflow_dispatch`). The updateUser decision doc's Option B describes the toggle watchdog as "same class as the W0 cookie-less canary".

**Vehicle assignment (the concrete decision):**

| Job | Vehicle | Why |
|---|---|---|
| Auto-revoke | **pg_cron, every minute**, one SECURITY DEFINER SQL function; alert via `net.http_post` | Detection data AND the revocation targets all live in the `auth` schema of the same database — unreachable via PostgREST (auth schema is not exposed), so an Edge Function adds a hop with zero capability gain. 1-minute cadence is what "minutes-to-detection" means; GitHub cron is best-effort and 15-min-grained. **Alert-path caveat:** every existing `net.http_post` in this repo targets internal Edge Functions; direct pg_net→Slack is **new ground**. It is attempted first (one call, standard JSON incoming-webhook); the precedented fallback, if the local drill fails, is a minimal `send-alert` Edge Function on the `x-cron-secret` pattern that the cron function posts to instead. |
| Toggle watchdog | **GitHub Actions daily cron** (`auth-toggle-watchdog.yml`), modeled line-for-line on `ingress-canary.yml` | The check needs a Supabase **Management API personal access token** (account-wide credential). That must not live in the project DB's Vault — the DB is part of what the watchdog guards, and a DB compromise would escalate to account-wide Management API access. GH repo secrets are the same trust boundary the canary already uses; daily cadence tolerates GH cron lag; Slack alerting is already wired there. |

**Toggle watchdog endpoint (verified against the live Management API OpenAPI spec, 2026-07-29):** `GET https://api.supabase.com/v1/projects/{ref}/config/auth` (operationId `v1-get-auth-service-config`, Bearer auth — personal access token, `sbp_…`). The `AuthConfigResponse` schema carries both flags as **nullable** booleans: `security_update_password_require_reauthentication` and `mailer_secure_email_change_enabled`. Prod ref: `lssnaapatrurmhbbqadb`.

**Considered and rejected:** (a) a trigger on auth-owned tables (seconds-to-detection) — fragile across GoTrue migrations, and the sign-off specifies a scheduled job riding the existing cron; (b) calling `revokeGrant` from an Edge Function — impossible without the user's JWT (above); (c) putting the watchdog on pg_cron — PAT-in-Vault objection (above); (d) matching `user_modified` or any broad audit action — self-triggering, refuted empirically (above); (e) adding a `created_at` index or any DDL to `auth.audit_log_entries` — auth-owned, off limits.

## Scope (files/areas)

- **New migration** `supabase/migrations/<timestamp>_detect_and_revoke_oauth_grants.sql`. All new objects live in `public`; the only writes to auth-owned tables are the revocation UPDATE/DELETE and the parity audit INSERT — **no DDL on auth-owned tables**. Every new table: RLS enabled with **no policies** + table privileges revoked from `public`/`anon`/`authenticated` (the `20260502095010_lock_handicap_queue.sql` pattern); every function: SECURITY DEFINER, `SET search_path = ''`, EXECUTE revoked from `public`/`anon`/`authenticated` (the `20260502104218` lesson: PUBLIC gets EXECUTE by default).
  - `public.oauth_auto_revocations` ledger: `id`, `audit_entry_id uuid NULL` (null for email-signal revocations), `signal text` (`'audit:user_updated_password'` | `'email_snapshot'`), `user_id uuid`, `oauth_client_id uuid`, `sessions_deleted int`, `detected_at timestamptz`, `UNIQUE (audit_entry_id, oauth_client_id)` (dedupes the audit path; the email path dedupes via the snapshot upsert — NULL `audit_entry_id` rows don't collide in the unique index, which is fine).
  - `public.oauth_watch_state`: single-row watermark (`k text PRIMARY KEY`, `last_processed_at timestamptz`) for the audit scan.
  - `public.oauth_watch_email_state`: snapshot per watched user — `user_id uuid PRIMARY KEY`, `email text`, `email_change text`, `email_change_sent_at timestamptz`, `captured_at timestamptz`.
  - `public.detect_and_revoke_oauth_grants()` — logic per tick:
    1. **Signal A — password (audit scan with watermark):** `auth.audit_log_entries` has indexes only on `id` (uuid PK) and `instance_id` — **no `created_at` index; `payload` is `json`, not `jsonb`**. The uuid PK is GoTrue-generated v4, **not orderable**, so the watermark is temporal: scan `WHERE created_at > (watermark − interval '2 minutes')` with `payload->>'action' = 'user_updated_password'` (the `->>` operator works on `json`), then advance the watermark to the max `created_at` seen. The 2-minute overlap covers clock skew and late commits; re-seen entries are deduped by the ledger unique constraint. **Honest cost note:** with no usable index this predicate is a sequential scan of the whole audit table every minute. Acceptable at current scale (small user base; the table grows with logins/refreshes), and the watermark bounds *processing*, not scan cost. Revisit tripwire: if the scan exceeds ~100 ms sustained (check cron run durations / `pg_stat_statements`) or the table passes ~5M rows, escalate — a coarser cadence or a Supabase audit-log-retention question; **not** an index on an auth-owned table. Join hits to live sessions: `s.user_id = (a.payload->>'actor_id')::uuid AND s.oauth_client_id IS NOT NULL AND s.created_at < a.created_at` (well-indexed side: `sessions_user_id_idx`, `user_id_created_at_idx`). The ordering predicate is **LOAD-BEARING for loop-prevention**, not just threat-scoping: inside the 2-minute overlap window it is the only thing preventing re-revocation of a freshly re-consented session (verified: with the predicate a re-consent inside the overlap yields 0 hits; without it, 1 hit — the ledger's `ON CONFLICT DO NOTHING` protects bookkeeping only and would not stop the DELETE). It also encodes the threat model — a token leaked from a *pre-existing* grant. As a second line of defense, the revoke itself is gated on a ledger pre-check (see step 3).
    **Signal A reachability (verified, `internal/models/user.go:377-383`):** GoTrue's `UpdatePassword` calls `LogoutAllExceptMe` — a password change kills every session EXCEPT the acting one. Two consequences: (a) the **attack case** — password changed *via the OAuth token* — is detected: the acting OAuth session survives the logout sweep and Signal A fires (verified: 1 hit); (b) a **first-party** password change kills the OAuth session before the job ever runs, so Signal A correctly yields ZERO hits — the grant's sessions and refresh tokens are already dead by cascade. In case (b) `auth.oauth_consents.revoked_at` stays NULL even though the grant is functionally dead, so `listGrants` still shows it as active — tidying that consent row, and alerting on first-party password changes as a suspect-compromise signal (which would need a session-*disappearance* sensor, not a session join), are both **explicitly out of scope** (see Non-goals).
    2. **Signal B — email (snapshot-compare):** for the (small, `sessions_oauth_client_id_idx`-indexed) set of users holding a live OAuth session, read `auth.users (email, email_change, email_change_sent_at)` and compare against `public.oauth_watch_email_state`. **Trigger rules (precise — naive `IS DISTINCT FROM` comparisons false-trigger, see the lifecycle table):**
       - `email` differs from the snapshot → a change **completed**;
       - `email_change` transitions to a *different non-empty* value — and the non-empty test must be `coalesce(email_change,'') <> ''` because the column's default is `''`, not NULL → a change **requested**;
       - `email_change_sent_at` makes a **forward move only** (snapshot value null-or-older AND new value non-null and newer) — **never on clearing**: a password change with an email change pending NULLs `email_change_sent_at` while leaving `email_change` populated (`internal/api/user.go:363,369`), so treating the null-ward transition as a trigger would false-fire on every such password change.
       With secure email change ON a request cannot complete silently, but a change request under a live OAuth grant is exactly the signal worth revoking on. First sight of a user = seed the snapshot, no action. After processing, upsert snapshots to current values and prune rows for users no longer in the live set (a later re-consenting user is re-seeded fresh — this trades detection of changes made while unwatched for a table that stays tiny; acceptable, since with no live grant there is nothing to revoke anyway).
       **Verified column lifecycle (GoTrue v2.183.0, local stack):**
       | Flow leg | `email` | `email_change` | `email_change_sent_at` |
       |---|---|---|---|
       | Request leg (`mail.go:561`) | — | set to new address | set |
       | First confirm leg (`verify.go:571`) | — | — (only `email_change_confirm_status`/tokens move — neither watched column) | — |
       | Final confirm (`user.go:493`) | updated to new address | cleared | — |
       | Password change with change pending (`user.go:363,369`) | — | — (stays populated) | **NULLed** |
    3. **Revoke** (per user × client hit, either signal). **Gate first:** for audit-signal hits, skip any hit whose `(audit_entry_id, oauth_client_id)` already exists in the ledger — a pre-check BEFORE revoking, not just `ON CONFLICT` at insert time (the insert-time conflict clause protects bookkeeping only; ordered revoke-first it would not stop a duplicate DELETE — this pre-check is the second line of defense behind the ordering predicate). Then: `UPDATE auth.oauth_consents SET revoked_at = now() WHERE user_id = … AND client_id = … AND revoked_at IS NULL;` `DELETE FROM auth.sessions WHERE user_id = … AND oauth_client_id = …;` (refresh tokens cascade); INSERT the parity `token_revoked` audit entry — supplying `id := gen_random_uuid()` explicitly (`auth.audit_log_entries.id` is uuid NOT NULL with **no default**) and letting `ip_address` take its `NOT NULL DEFAULT ''` — with the payload shape copied from an observed real `revokeGrant`; INSERT the ledger row (`ON CONFLICT DO NOTHING` retained as belt-and-braces).
    4. **Alert:** if any ledger rows were newly inserted, `PERFORM net.http_post(...)` to the Slack webhook from `vault.decrypted_secrets WHERE name = 'alerting_slack_webhook'` at execution time (never persisted in `cron.job` — the `20260430120000` discipline). Alert failure must NOT roll back the revocation — revoke first; alert best-effort, missing secret degrades to `RAISE WARNING`. **No PII in alerts or logs** — user id + client id + signal only.
  - `cron.schedule('detect-and-revoke-oauth-grants', '* * * * *', 'SELECT public.detect_and_revoke_oauth_grants();')` via a setup function following `setup_handicap_queue_cron()` (idempotent unschedule-then-schedule).
- **Fallback (only if the direct Slack post fails the local drill):** `supabase/functions/send-alert/` Edge Function (`verify_jwt = false` + `x-cron-secret`, the `process-handicap-queue` pattern), with the cron function posting to it instead of Slack directly.
- **New workflow** `.github/workflows/auth-toggle-watchdog.yml`: daily cron + `workflow_dispatch`; `curl` the Management API endpoint with `Authorization: Bearer ${{ secrets.SUPABASE_MGMT_PAT }}`; extract exactly the two flags with `jq` and **branch the failure message per flag**: value `false` → "SETTING FLIPPED OFF — the updateUser defense is down, re-enable now"; value `null`/absent → "flag returned null/absent — unverifiable (field renamed? config unreadable?), investigate" (the spec marks both booleans `nullable: true`; a bare `== true` check fails safe on null but the two situations demand different responses). Fail the job in both cases; Slack alert step copied from `ingress-canary.yml` (reuses `SLACK_WEBHOOK_URL`, degrades to `::warning` if unset). Never print the response body wholesale (the auth config contains SMTP/provider secrets) — extract only the two booleans.
- **Integration test** `apps/web/tests/integration/oauth-detect-and-revoke.test.ts` — reuse the OAuth-token-minting helpers from `apps/web/tests/integration/oauth-client-tokens.test.ts` (PR #167).
- `docs/research/api-platform/plans/000-INDEX.md` — 009 row (done in this PR).

## Step-by-step

1. Read the four pattern sources end to end: `20251207150153_schedule_queue_processor.sql`, `20260430120000_secure_queue_cron_with_secret.sql`, `20260502095010_lock_handicap_queue.sql`, `.github/workflows/ingress-canary.yml`. Also `apps/web/tests/integration/oauth-client-tokens.test.ts` for the token-minting helpers.
2. **Re-confirm the pinned email-change column lifecycle on your stack** (the table in Scope Signal B is the verified baseline; there is no audit action to hunt — v2.183.0 has none for email changes, full stop). **ENVIRONMENT WARNING, read before attempting:** the local `send_email` hook 401s out of the box — the hook's Edge Function requires a JWT and only `process-handicap-queue` has `verify_jwt = false` in `supabase/config.toml` (line ~169) — and GoTrue persists the email-change columns **only after a successful send** (`internal/mailer/mail.go:545-568`). "Mailpit up, run both legs" therefore fails as written: first bypass or reconfigure the hook locally (temporarily set `verify_jwt = false` for the mailer function, or disable the send-email hook so GoTrue falls back to built-in SMTP→Mailpit); revert before committing. Then run both legs of a secure email change for a user holding an OAuth session and confirm the lifecycle table (including the password-change-NULLs-`email_change_sent_at` row). Also perform one real `supabase.auth.oauth.revokeGrant({clientId})` and copy the exact `token_revoked` payload shape for the parity INSERT. Document both in the migration comment.
3. Write the migration per Scope. Follow migration-history discipline (no phantom "applied" rows).
4. Write the integration test (see Test strategy) — the two no-self-trigger criteria are merge-blocking.
5. Run the local alert drill: point `alerting_slack_webhook` at a test webhook, force one revocation, confirm delivery via direct pg_net. If it fails, build the `send-alert` Edge Function fallback and re-drill; record which path shipped.
6. Write `auth-toggle-watchdog.yml` per Scope; verify the false-vs-null branching locally by piping doctored JSON fixtures through the jq assertion.
7. `pnpm check:schema-sync`; `pnpm gen:types` (keep generated types in sync — the new tables are service-role-only but must not drift); `pnpm lint`; `pnpm test:integration`.
8. Hand the OWNER checklist below to the owner. **Post-deploy:** verify the DDL ran via a prod **dump**, not migration history (Ballerud/shot-level-stats lesson); confirm the `cron.job` row exists; `workflow_dispatch` the watchdog once and confirm green.

## Binding conditions (verbatim)

From **DECISIONS.md §Sign-off: updateUser residual (owner, 2026-07-29)**:

> **Fast-follow subplan (NEW, own PR — NOT a blocker for #167):** (1) audit-log auto-revoke — scheduled job watching `auth.audit_log_entries` for password/email-change events on users holding an active session `WHERE oauth_client_id IS NOT NULL` → `revokeGrant()` + alert (collapses the 24h window to minutes-to-detection); (2) toggle watchdog — daily check that secure-password-change + secure-email-change remain ON, alert if either flips off (the two settings are the whole defense; guard against silent drift). Both ride the existing cron.

> **Decision: accept-with-mitigations + build the detective control.** Load-bearing prod settings (verified ON by owner 2026-07-29): "secure password change" (reauth for sessions >24h) and "secure email change" (double-confirm). NOTE: the "double confirm email changes" label the plan referenced is surfaced as **secure email change** in the current dashboard — same mechanism, verified enabled.

From **`004-updateuser-decision.md` Option B** (the commissioned shape of the watchdog):

> **B. Accept, plus a detection tripwire.** Option A + a scheduled canary asserting `double_confirm_changes` and `secure_password_change` remain enabled on the hosted project (same class as the W0 cookie-less canary — a dashboard-side settings change silently re-opens the surface). Cheap; recommended as a fast-follow if A is signed.

Interpretation notes, stated for the record: (a) "Both ride the existing cron" is read as *the existing scheduled-job infrastructure* — pg_cron for the auto-revoke (data and targets are in-database) and the existing GH Actions cron lane for the watchdog (the Management API PAT must not live in the database it guards); if the owner intended strictly pg_cron for both, the PAT-placement objection is the reason to push back before complying. (b) The sign-off says "watching `auth.audit_log_entries` for password/email-change events" — verified fact: **email-change events do not exist in the v2.183.0 audit log** (only the self-triggering catch-all `user_modified` fires on those flows), so the email half of the intent is delivered via the snapshot-compare mechanism instead. Same detection outcome, different sensor; this paragraph is the record of that deliberate deviation.

## Test strategy

**Local integration (`pnpm test:integration`, real local Supabase — do not mock the DB):**
- Mint a real OAuth session (helpers from `oauth-client-tokens.test.ts`): admin-create client → consent → token exchange.
- **Password signal — MUST drive the change through the OAuth bearer token** (`PUT /auth/v1/user` authenticated with the OAuth access token), NOT a first-party `updateUser`. Reason (verified): `UpdatePassword` calls `LogoutAllExceptMe` (`user.go:377-383`) — a first-party change kills the OAuth session before the job runs, so the natural first-party phrasing yields zero ledger rows and reads as a broken function; only the attack-shaped change (via the OAuth token, whose acting session survives) exercises Signal A. Then call `SELECT public.detect_and_revoke_oauth_grants()` directly (don't wait for the cron tick). Assert: `auth.getUser(<oauth token>)` fails; OAuth refresh via `/auth/v1/oauth/token` fails; `auth.oauth_consents.revoked_at` set; session row gone; one ledger row (`signal = 'audit:user_updated_password'`); one parity `token_revoked` audit entry with `payload->>'action' = 'revoke_oauth_grant'`.
- **First-party password change (expected zero):** with an OAuth session live, change the password first-party; run the function. Assert **zero** ledger rows AND that the OAuth session is already gone (killed by `LogoutAllExceptMe`, refresh tokens cascaded) — the grant is functionally dead without the job's help, and `oauth_consents.revoked_at` remains NULL (the documented, accepted scope gap — see Non-goals).
- **Email signal:** seed the snapshot (one tick), then run the email-change request leg; next tick revokes; assert as above with `signal = 'email_snapshot'`, `audit_entry_id IS NULL`.
- **No-self-trigger (MERGE-BLOCKING acceptance criteria):**
  - (a) an OAuth-client token performing `updateUser({ data: … })` (metadata write — the op spike criterion vi proved works) followed by a function run → **zero** revocations, zero ledger rows;
  - (b) the refresh-claims write — `updateUser({ data: { last_claims_refresh } })`, exactly what `apps/web/app/api/auth/refresh-claims/route.ts:46` performs after checkout — on a fitbull-connected user, followed by a function run → **zero** revocations.
- **Idempotence:** run the function again after each scenario → no new ledger rows, no errors (watermark advanced; audit path deduped by `UNIQUE (audit_entry_id, oauth_client_id)`; email path deduped by the upserted snapshot).
- **No-loop / re-consent semantics:** after a revocation, re-consent the same user × client **immediately — inside the 2-minute overlap window, while the triggering audit entry is still in scan range** (the demanding case: here the ordering predicate `s.created_at < a.created_at` is load-bearing, backed by the ledger pre-check; the watermark only covers entries that have aged out). `auth.oauth_consents` has `UNIQUE (user_id, client_id)` and GoTrue **un-revokes the existing row** (`oauth_consent.go:158`, RevokedAt = nil) rather than inserting a new one — assert the **same consent row id** now has `revoked_at IS NULL` (not a second row), the new session exists, and a further function run leaves both untouched.
- **Scoping negatives:** a password change by a user with no OAuth session → no-op; a first-party session of the same user alongside an OAuth session → the first-party session survives (only `oauth_client_id IS NOT NULL` rows deleted).
- **Cron registration:** after `supabase db reset`, a `cron.job` row named `detect-and-revoke-oauth-grants` exists.
- **Alert path:** with the Vault secret absent, the function still revokes (warning, no throw). Delivery itself is the manual drill (step 5), not an automated test.

**Prod smoke (cannot be tested locally):**
- DDL verified via prod dump; `cron.job` row present; one manual `SELECT public.detect_and_revoke_oauth_grants()` returning zero hits (no OAuth sessions exist until the owner enables the OAuth server — safe no-op before then).
- Watchdog: `workflow_dispatch` run green against the real Management API with the real PAT (this also re-automates the owner's 2026-07-29 by-hand verification of the two flags). Do NOT test the failure path by flipping prod settings; the false-vs-null branching is verified locally against doctored fixtures (step 6).
- Optional end-to-end drill (owner discretion, after OAuth server enablement): consent with a test account in prod, change its password, observe revocation + Slack alert within ~2 minutes.
- Sustained-cost check after a week: the audit scan stays well under the ~100 ms tripwire (cron run durations / `pg_stat_statements`).

## Rollback

- **Auto-revoke:** `SELECT cron.unschedule('detect-and-revoke-oauth-grants');` stops the job instantly (SQL editor, no deploy). Full removal = a down migration dropping the functions and the three `public` tables. Already-performed revocations are **not rolled back** — affected users re-consent from fitbull (GoTrue un-revokes their existing consent row); that is the designed cost of a false positive.
- **Watchdog:** delete/disable `auth-toggle-watchdog.yml` (or disable the workflow in the Actions UI). No state to unwind.
- Neither job changes any auth setting or performs DDL on auth-owned tables; the only auth-schema writes are the revocation UPDATE/DELETE and the parity audit INSERT.
- **Fragility watch:** the SQL replicates GoTrue-internal revocation semantics against GoTrue-owned tables, and the snapshot-compare reads GoTrue-owned columns — a GoTrue upgrade may change either. The integration test is the tripwire — it proves post-revoke `getUser` fails and the email columns still transition as pinned on the *current* GoTrue; if Supabase later ships an **admin** grant-revocation endpoint or real email-change audit actions, switch to them and retire the workarounds.

## OWNER (dashboard/secrets — not agent work)

- [ ] Create the Slack incoming-webhook Vault secret: `SELECT vault.create_secret('<url>', 'alerting_slack_webhook');` (SQL editor, postgres role — same runbook as `handicap_cron_secret`).
- [ ] Create a Supabase **personal access token** scoped for Management API reads and add it as the `SUPABASE_MGMT_PAT` GitHub repo secret.
- [ ] `SLACK_WEBHOOK_URL` GitHub repo secret (already an open OWNER item from the ingress canary — one webhook serves both).
- [ ] Confirm (or schedule) OAuth server enablement on the hosted project (spike OWNER item) — until then the auto-revoke job idles at zero hits.

## Non-goals

- **Any preventive control.** RLS cannot see GoTrue's `updateUser` writes, the access-token hook cannot authorize them, and no GoTrue v2.183.0 config lever exempts OAuth sessions from `/auth/v1/user` (`004-updateuser-decision.md`). Do not add triggers on `auth.users`, do not proxy GoTrue (rejected Option C), do not wait for Phase-2 scopes (rejected Option D).
- **Any DDL on auth-owned tables** — no indexes on `auth.audit_log_entries`, no triggers, no columns. Data-row inserts (the parity audit entry) are the permitted ceiling.
- Matching `user_modified` or any broad audit action — refuted as self-triggering; the watch list is closed at `user_updated_password`.
- Changing the two secure-change settings themselves, or any other auth config — the watchdog reads, never writes (`GET`, not `PATCH`).
- Realtime/trigger-based detection on auth-schema tables (rejected above; the sign-off says cron).
- Alerting infrastructure beyond the Slack-webhook pattern (no PagerDuty, no Sentry cron monitors).
- Revoking first-party sessions, MFA changes, or any event class beyond password/email change.
- **Tidying consent rows orphaned by first-party password changes** — `LogoutAllExceptMe` kills the OAuth sessions (grant functionally dead: no sessions, no refresh tokens) but leaves `oauth_consents.revoked_at` NULL, so `listGrants` still shows the grant as active. Declared OUT of scope: cosmetic, no live credential exists, and the user can revoke from the grants UI. Likewise **alerting on first-party password changes as a suspect-compromise signal** — that would need a session-*disappearance* sensor (the sessions are gone before the job runs, so the live-session join can never see them), a different mechanism than this plan's; revisit only if the owner asks for it.
- fitbull-side handling of a revoked grant (fitbull re-runs Connect — that is 007 territory).

## Definition of done

- Migration applied: function + watermark + snapshot + ledger tables + every-minute cron job, privileges locked down per repo discipline; `pnpm check:schema-sync` clean.
- Email-change column transitions and the `token_revoked` payload shape pinned empirically on the local stack and documented in the migration.
- All integration tests pass (`pnpm test:integration`) — **including both merge-blocking no-self-trigger criteria** (OAuth-client metadata write; refresh-claims route write).
- Alert drill delivered (direct pg_net, or the Edge Function fallback, with the shipped choice recorded).
- `auth-toggle-watchdog.yml` merged; manual dispatch green against prod; asserts `security_update_password_require_reauthentication` and `mailer_secure_email_change_enabled` from `GET /v1/projects/lssnaapatrurmhbbqadb/config/auth`, with distinct false-vs-null alert texts; leaks no config fields to logs.
- Post-deploy prod checks done (dump-verified DDL, `cron.job` row, no-op manual run).
- OWNER checklist handed over; alert delivery confirmed once secrets exist.

## Verification commands

```bash
pnpm check:schema-sync   # migration/schema drift
pnpm test:integration    # both signals, no-self-trigger pair, idempotence, re-consent un-revoke, negatives
pnpm lint
```

Manual: `SELECT jobname, schedule FROM cron.job;` shows `detect-and-revoke-oauth-grants` on `* * * * *` (local + prod); `gh workflow run auth-toggle-watchdog.yml` then confirm the run is green.
