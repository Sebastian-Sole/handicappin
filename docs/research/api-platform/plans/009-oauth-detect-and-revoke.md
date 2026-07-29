# 009 — OAuth detect-and-revoke fast-follow (audit-log auto-revoke + toggle watchdog)

**Workstream:** W2 fast-follow · **Status:** PENDING · **Billing-gated:** No
**Depends on:** PR #167 merged (subplan 004 build — done 2026-07-29); OWNER enablement of the OAuth server on the hosted project (the job is a safe no-op before that).
**Blocks:** nothing. Explicitly **NOT a blocker for launch** — DECISIONS §Sign-off calls it "NEW, own PR — NOT a blocker for #167".

---

## Goal

Build the **detective control** accepted in the updateUser sign-off (DECISIONS.md, owner, 2026-07-29). Two scheduled jobs:

1. **Audit-log auto-revoke** — a pg_cron job (every minute) that watches `auth.audit_log_entries` for password/email-change events on users holding an active OAuth session (`auth.sessions WHERE oauth_client_id IS NOT NULL`), revokes the OAuth grant, and alerts. This collapses the accepted 24h residual window (leaked `client_id` token can change the password with no reauth within 24h of original consent) to **minutes-to-detection**.
2. **Toggle watchdog** — a daily GitHub Actions cron that reads the hosted project's auth config via the Supabase Management API and alerts if **secure password change** (`security_update_password_require_reauthentication`) or **secure email change** (`mailer_secure_email_change_enabled`) has flipped off. These two settings are the whole defense; guard against silent dashboard drift.

Neither job is a preventive control. **No preventive lever exists** — GoTrue mutates `auth.users` over its own privileged connection (`supabase_auth_admin`), invisible to RLS/triggers at `updateUser` time (see `004-updateuser-decision.md` "Why no code-level deny was shipped"). This plan detects and revokes; it does not attempt to prevent, and must not drift into inventing a preventive mechanism.

## Background

Spike criterion (vi) proved an OAuth-client access token works directly against GoTrue: `updateUser({ user_metadata })` succeeds, and password/email-change requests are accepted (`plans/004-spike-results.md`). The owner accepted the residual with two load-bearing prod settings verified ON (secure password change, secure email change) and commissioned this fast-follow. The 24h window is **non-renewable** (refresh keeps the session's `created_at`; a new session needs the user's browser), the attack is **self-signaling** (a password change kills other sessions and lands in the audit log), and email change is double-confirmed. So the detection signal is crisp: *a password/email-change audit event on a user who holds a live OAuth-client session that predates the event.*

**The real revocation mechanism (located, primary sources):** GoTrue's user-facing revocation is `DELETE /auth/v1/user/oauth/grants?client_id=<uuid>` — surfaced in supabase-js (pinned 2.95.3) as `supabase.auth.oauth.revokeGrant({ clientId })` (`GoTrueClient._revokeOAuthGrant`). Its documented semantics: "marks consent as revoked, deletes active sessions for that OAuth client, and invalidates associated refresh tokens." The spike measured post-revoke `getUser` failure at ~47 ms (criterion iii). **But it is user-JWT-scoped** — it authenticates with the user's own live access token, which a scheduled job does not have. **No admin equivalent exists in GoTrue v2.184**: `GoTrueAdminApi.oauth` is client CRUD only (`/admin/oauth/clients` list/create/get/update/delete/regenerate_secret — verified in auth-js 2.95.3 dist). Therefore the job replicates `revokeGrant`'s three documented effects directly in SQL against the auth schema (all verified on the local stack, GoTrue v2.184):

- `auth.oauth_consents(id, user_id, client_id, scopes, granted_at, revoked_at)` — revocation = `SET revoked_at = now()`;
- `auth.sessions.oauth_client_id uuid` (FK → `auth.oauth_clients`) — delete the rows;
- `auth.refresh_tokens.session_id` FK is **ON DELETE CASCADE** → refresh tokens die with the session.

Server-side token validation goes through GoTrue's `getUser` network check (`getUserFromBearerToken` in `apps/web/server/api/trpc.ts`), so deleting the session invalidates the access token within milliseconds — same enforcement path the spike measured. The JWKS caveat from criterion iii stands: a consumer validating locally via cached JWKS would silently miss revocation; we never do that for external tokens.

**Audit signal shape** (verified against local `auth.audit_log_entries`): `payload` is JSON like `{"action":"user_updated_password","actor_id":"<user uuid>","actor_username":"...","log_type":"user"}`. Local distinct actions include `user_updated_password` and `user_modified` (the generic user-update action; the local email-change flow 500s on the mailer hook, so email-change-specific action names could not be enumerated locally — see step 2).

**Existing cron vehicles in this repo** ("both ride the existing cron" — sign-off):

- **pg_cron + pg_net + Vault** — `process-handicap-queue` runs every minute via `cron.schedule` → `net.http_post` to an Edge Function, secret from `vault.decrypted_secrets` at tick time (`supabase/migrations/20251207150153_schedule_queue_processor.sql`, hardened in `20260430120000_secure_queue_cron_with_secret.sql`). Also plain-SQL daily jobs (`20251211151609_cleanup_expired_email_changes.sql`). Runs in prod today.
- **GitHub Actions cron** — `ingress-canary.yml` (*/15, Slack webhook alert step, `workflow_dispatch` for manual runs). The updateUser decision doc's Option B describes the toggle watchdog as "same class as the W0 cookie-less canary".

**Vehicle assignment (the concrete decision):**

| Job | Vehicle | Why |
|---|---|---|
| Audit-log auto-revoke | **pg_cron, every minute**, one SECURITY DEFINER SQL function; alert via `net.http_post` (Slack webhook from Vault, same pattern as `handicap_cron_secret`) | Detection data AND the revocation targets all live in the `auth` schema of the same database — unreachable via PostgREST (auth schema is not exposed), so an Edge Function adds a hop with zero capability gain (it would have to call the same SQL). 1-minute cadence is what "minutes-to-detection" means; GitHub cron is best-effort and 15-min-grained. pg_cron + pg_net + Vault is the established, prod-proven lane. |
| Toggle watchdog | **GitHub Actions daily cron** (`auth-toggle-watchdog.yml`), modeled line-for-line on `ingress-canary.yml` | The check needs a Supabase **Management API personal access token** (account-wide credential). That must not live in the project DB's Vault — the DB is part of what the watchdog guards, and a DB compromise would escalate to account-wide Management API access. GH repo secrets are the same trust boundary the canary already uses; daily cadence tolerates GH cron lag; Slack alerting is already wired there. |

**Toggle watchdog endpoint (verified against the live Management API OpenAPI spec, 2026-07-29):** `GET https://api.supabase.com/v1/projects/{ref}/config/auth` (operationId `v1-get-auth-service-config`, Bearer auth — use a personal access token, `sbp_…`). The `AuthConfigResponse` schema contains both flags as booleans: `security_update_password_require_reauthentication` and `mailer_secure_email_change_enabled`. Prod ref: `lssnaapatrurmhbbqadb`. (The spike could not read prod auth config from the local command classifier; the GH runner has no such restriction.)

**Considered and rejected:** (a) a trigger on `auth.audit_log_entries` (seconds-to-detection) — triggers on GoTrue-owned tables are fragile across GoTrue migrations, and the sign-off specifies a scheduled job riding the existing cron; (b) calling `revokeGrant` from an Edge Function — impossible without the user's JWT (above); (c) putting the watchdog on pg_cron — PAT-in-Vault objection (above).

## Scope (files/areas)

- **New migration** `supabase/migrations/<timestamp>_detect_and_revoke_oauth_grants.sql`:
  - `public.oauth_auto_revocations` ledger table: `id`, `audit_entry_id uuid`, `user_id uuid`, `oauth_client_id uuid`, `audit_action text`, `sessions_deleted int`, `detected_at timestamptz`, `UNIQUE (audit_entry_id, oauth_client_id)`. RLS enabled with **no policies** + table privileges revoked from `public`/`anon`/`authenticated` (the `20260502095010_lock_handicap_queue.sql` pattern — deny by default, service_role/postgres only).
  - `public.detect_and_revoke_oauth_grants()` — SECURITY DEFINER, `SET search_path = ''`, EXECUTE revoked from `public`/`anon`/`authenticated` (the `20260502104218` lesson: PUBLIC gets EXECUTE by default; revoke it explicitly). Logic:
    1. **Detect:** audit entries in the trailing **24h** (matches the non-renewable residual window; survives extended cron outages) with `payload->>'action'` in the watch list, joined to live `auth.sessions s` on `s.user_id = (payload->>'actor_id')::uuid` where `s.oauth_client_id IS NOT NULL` **and `s.created_at < a.created_at`** — the threat is a token leaked from a *pre-existing* grant; sessions created after the event are fresh re-consents by the legitimate user and must not be re-revoked (this ordering predicate is also what prevents a revoke/re-consent loop inside the 24h scan window).
    2. **Revoke** (replicating `revokeGrant` semantics): `UPDATE auth.oauth_consents SET revoked_at = now() WHERE user_id = … AND client_id = … AND revoked_at IS NULL;` then `DELETE FROM auth.sessions WHERE user_id = … AND oauth_client_id = …;` (refresh tokens cascade). Insert a ledger row per (audit entry, client) with `ON CONFLICT DO NOTHING`.
    3. **Alert:** if any ledger rows were newly inserted this tick, `PERFORM net.http_post(...)` to the Slack webhook read from `vault.decrypted_secrets WHERE name = 'alerting_slack_webhook'` at execution time (never persisted in `cron.job` — the `20260430120000` discipline). Alert failure must NOT roll back the revocation: revoke first, commit-safe; alert best-effort with the missing-secret case degrading to a `RAISE WARNING`. **Do not log token contents or emails** — user id + client id + action only (observability rules: no PII).
  - `cron.schedule('detect-and-revoke-oauth-grants', '* * * * *', 'SELECT public.detect_and_revoke_oauth_grants();')` via a setup function following `setup_handicap_queue_cron()` (idempotent unschedule-then-schedule).
- **New workflow** `.github/workflows/auth-toggle-watchdog.yml`: daily cron (plus `workflow_dispatch`), `curl` the Management API endpoint above with `Authorization: Bearer ${{ secrets.SUPABASE_MGMT_PAT }}`, `jq -e '.security_update_password_require_reauthentication == true and .mailer_secure_email_change_enabled == true'`, fail otherwise; Slack alert step copied from `ingress-canary.yml` (reuses `SLACK_WEBHOOK_URL`, degrades to a `::warning` if unset). Never print the response body wholesale (the auth config contains SMTP/provider secrets) — extract only the two booleans.
- **Integration test** `apps/web/tests/integration/oauth-detect-and-revoke.test.ts` — reuse the OAuth-token-minting helpers from `apps/web/tests/integration/oauth-client-tokens.test.ts` (PR #167).
- `docs/research/api-platform/plans/000-INDEX.md` — 009 row (done in this PR).

## Step-by-step

1. Read the four pattern sources end to end: `20251207150153_schedule_queue_processor.sql`, `20260430120000_secure_queue_cron_with_secret.sql`, `20260502095010_lock_handicap_queue.sql`, `.github/workflows/ingress-canary.yml`. Also `apps/web/tests/integration/oauth-client-tokens.test.ts` for the token-minting helpers.
2. **Pin the audit action watch list empirically.** On the local stack, with a seeded user holding an OAuth session: change the password (`updateUser({password})`) and attempt an email change (Mailpit is up locally, so the change request should now log; if the mailer hook still 500s, note it and keep the catch-all). Record every distinct `payload->>'action'` each flow produces. Start list: `('user_updated_password', 'user_modified')`. `user_modified` is a broad catch-all — that is deliberate: a false positive costs one re-consent in fitbull (cheap, self-healing); a false negative is the account-takeover window. Document the final list and its evidence in the migration comment.
3. Write the migration per Scope. Follow migration-history discipline (no phantom "applied" rows).
4. Write the integration test (see Test strategy).
5. Write `auth-toggle-watchdog.yml` per Scope.
6. `pnpm check:schema-sync`; `pnpm gen:types` (only if the ledger table should appear in generated types — it is service-role-only, but keep types in sync); `pnpm lint`; `pnpm test:integration`.
7. Hand the OWNER checklist below to the owner. **Post-deploy:** verify the DDL ran via a prod **dump**, not migration history (Ballerud/shot-level-stats lesson); confirm the `cron.job` row exists; `workflow_dispatch` the watchdog once and confirm green.

## Binding conditions (verbatim)

From **DECISIONS.md §Sign-off: updateUser residual (owner, 2026-07-29)**:

> **Fast-follow subplan (NEW, own PR — NOT a blocker for #167):** (1) audit-log auto-revoke — scheduled job watching `auth.audit_log_entries` for password/email-change events on users holding an active session `WHERE oauth_client_id IS NOT NULL` → `revokeGrant()` + alert (collapses the 24h window to minutes-to-detection); (2) toggle watchdog — daily check that secure-password-change + secure-email-change remain ON, alert if either flips off (the two settings are the whole defense; guard against silent drift). Both ride the existing cron.

> **Decision: accept-with-mitigations + build the detective control.** Load-bearing prod settings (verified ON by owner 2026-07-29): "secure password change" (reauth for sessions >24h) and "secure email change" (double-confirm). NOTE: the "double confirm email changes" label the plan referenced is surfaced as **secure email change** in the current dashboard — same mechanism, verified enabled.

From **`004-updateuser-decision.md` Option B** (the commissioned shape of the watchdog):

> **B. Accept, plus a detection tripwire.** Option A + a scheduled canary asserting `double_confirm_changes` and `secure_password_change` remain enabled on the hosted project (same class as the W0 cookie-less canary — a dashboard-side settings change silently re-opens the surface). Cheap; recommended as a fast-follow if A is signed.

Interpretation note, stated for the record: "Both ride the existing cron" is read as *the existing scheduled-job infrastructure* — pg_cron for the auto-revoke (data and targets are in-database) and the existing GH Actions cron lane for the watchdog (the Management API PAT must not live in the database it guards). If the owner intended strictly pg_cron for both, the PAT-placement objection is the reason to push back before complying.

## Test strategy

**Local integration (`pnpm test:integration`, real local Supabase — do not mock the DB):**
- Mint a real OAuth session (helpers from `oauth-client-tokens.test.ts`): admin-create client → consent → token exchange.
- Change the user's password via `updateUser`; call `SELECT public.detect_and_revoke_oauth_grants()` directly (don't wait for the cron tick). Assert: `auth.getUser(<oauth token>)` now fails; OAuth refresh via `/auth/v1/oauth/token` fails; `auth.oauth_consents.revoked_at` is set; the session row is gone; exactly one ledger row per (audit entry, client).
- Idempotence: call the function again → no new ledger rows, no errors.
- No-loop: re-consent after revocation (new session), call again → the new session survives (ordering predicate).
- Negative: a password change by a user with **no** OAuth session → no revocation, no ledger row. A first-party session of the *same* user with an OAuth session → first-party session survives (only `oauth_client_id IS NOT NULL` rows deleted).
- Cron registration: after `supabase db reset`, assert a `cron.job` row named `detect-and-revoke-oauth-grants` exists.
- Alert path: with the Vault secret absent, the function still revokes (warning, no throw). Full Slack delivery is not integration-testable locally — accept a unit-level check of the constructed payload or manual verification.

**Prod smoke (cannot be tested locally):**
- DDL verified via prod dump; `cron.job` row present; one manual `SELECT public.detect_and_revoke_oauth_grants()` returning zero hits (no OAuth sessions exist until the owner enables the OAuth server — the job is a safe no-op before then).
- Watchdog: `workflow_dispatch` run is green against the real Management API with the real PAT (this also re-verifies the two prod flags are ON — the same check the owner did by hand on 2026-07-29, now automated). Do NOT test the failure path by flipping prod settings; verify the jq assertion's failure behavior locally against a doctored JSON fixture instead.
- Optional end-to-end drill (owner discretion, after OAuth server enablement): consent with a test account in prod, change its password, observe revocation + Slack alert within ~2 minutes.

## Rollback

- **Auto-revoke:** `SELECT cron.unschedule('detect-and-revoke-oauth-grants');` stops the job instantly (SQL editor, no deploy). Full removal = a down migration dropping the function, setup function, and ledger table. Already-performed revocations are **not rolled back** — affected users simply re-consent from fitbull; that is the designed cost of a false positive.
- **Watchdog:** delete/disable `auth-toggle-watchdog.yml` (or disable the workflow in the Actions UI). No state to unwind.
- Neither job changes any auth setting, token, or schema owned by GoTrue except the two revocation writes above; there is no migration of user data to reverse.
- **Fragility watch:** the SQL replicates GoTrue-internal revocation semantics against GoTrue-owned tables (`oauth_consents`, `sessions`). A GoTrue upgrade may change these. The integration test is the tripwire — it proves post-revoke `getUser` fails on the *current* GoTrue; if Supabase later ships an **admin** grant-revocation endpoint, switch the function to call it (via an Edge Function) and retire the direct DML.

## OWNER (dashboard/secrets — not agent work)

- [ ] Create the Slack incoming-webhook Vault secret: `SELECT vault.create_secret('<url>', 'alerting_slack_webhook');` (SQL editor, postgres role — same runbook as `handicap_cron_secret`).
- [ ] Create a Supabase **personal access token** scoped for Management API reads and add it as the `SUPABASE_MGMT_PAT` GitHub repo secret.
- [ ] `SLACK_WEBHOOK_URL` GitHub repo secret (already an open OWNER item from the ingress canary — one webhook serves both).
- [ ] Confirm (or schedule) OAuth server enablement on the hosted project (spike OWNER item) — until then the auto-revoke job idles at zero hits.

## Non-goals

- **Any preventive control.** RLS cannot see GoTrue's `updateUser` writes, the access-token hook cannot authorize them, and no GoTrue v2.184 config lever exempts OAuth sessions from `/auth/v1/user` (`004-updateuser-decision.md`). Do not add triggers on `auth.users`, do not proxy GoTrue (rejected Option C), do not wait for Phase-2 scopes (rejected Option D).
- Changing the two secure-change settings themselves, or any other auth config — the watchdog reads, never writes (`GET`, not `PATCH`).
- Realtime/trigger-based detection on auth-schema tables (rejected above; the sign-off says cron).
- Alerting infrastructure beyond the existing Slack-webhook pattern (no PagerDuty, no Sentry cron monitors).
- Revoking first-party sessions, MFA changes, or any event class beyond password/email change.
- fitbull-side handling of a revoked grant (fitbull re-runs Connect — that is 007 territory).

## Definition of done

- Migration applied: function + ledger + every-minute cron job, privileges locked down per repo discipline; `pnpm check:schema-sync` clean.
- Audit action watch list pinned empirically on the local stack and documented in the migration.
- Integration tests above pass against the local stack (`pnpm test:integration`).
- `auth-toggle-watchdog.yml` merged; manual dispatch green against prod; asserts exactly `security_update_password_require_reauthentication == true` and `mailer_secure_email_change_enabled == true` from `GET /v1/projects/lssnaapatrurmhbbqadb/config/auth`; leaks no config fields to logs.
- Post-deploy prod checks done (dump-verified DDL, `cron.job` row, no-op manual run).
- OWNER checklist handed over; alert delivery confirmed once secrets exist.

## Verification commands

```bash
pnpm check:schema-sync   # migration/schema drift
pnpm test:integration    # detect→revoke→getUser-fails round trip, idempotence, no-loop, negatives
pnpm lint
```

Manual: `SELECT jobname, schedule FROM cron.job;` shows `detect-and-revoke-oauth-grants` on `* * * * *` (local + prod); `gh workflow run auth-toggle-watchdog.yml` then confirm the run is green.
