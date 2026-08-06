-- ============================================================================
-- OAuth detect-and-revoke fast-follow (api-platform subplan 009)
-- ============================================================================
--
-- The detective control accepted in the updateUser sign-off
-- (docs/research/api-platform/DECISIONS.md, owner 2026-07-29). A leaked
-- OAuth-client access token can, within 24h of the original consent, drive a
-- password or email change directly against GoTrue's `PUT /auth/v1/user`
-- (spike criterion vi). No preventive lever exists: GoTrue mutates
-- `auth.users` over its own privileged connection, invisible to RLS/triggers.
-- This every-minute pg_cron job collapses that 24h residual to
-- minutes-to-detection by watching for the attack's signals on users holding
-- a live OAuth session, and replicating GoTrue's own grant-revocation in SQL.
--
-- ── Two detection signals (empirically pinned on GoTrue v2.183.0, the version
--    this local stack runs — `GET /auth/v1/health` -> v2.183.0) ─────────────
--
--   Signal A — PASSWORD: the audit action `user_updated_password`. Verified
--   on the local stack: driving `PUT /auth/v1/user {password}` with an OAuth
--   BEARER token emits exactly ['user_updated_password','user_modified'] and
--   the ACTING OAuth session SURVIVES GoTrue's LogoutAllExceptMe sweep
--   (internal/models/user.go:377-383) — the first-party session is deleted,
--   the oauth_client_id session remains, so the attack is detectable. The
--   watch list is CLOSED at 'user_updated_password'. `user_modified` fires
--   unconditionally on every PUT /user (metadata writes included — the exact
--   benign op the refresh-claims route performs) and MUST NOT be matched, or
--   the job self-triggers.
--
--   Signal A is guarded against a malformed `actor_id` on a WATCHED action:
--   the cast that reads it would otherwise throw and, since the body is one
--   transaction, roll back the watermark advance with it — wedging the
--   control permanently. See the guard comment on the scan itself.
--
--   Signal B — EMAIL: GoTrue v2.183.0 has NO email-change audit action, so
--   email changes are detected by snapshot-comparing `auth.users` columns.
--   Snapshot seeding on first sight does NOT blindly skip: a change requested
--   after the grant was created is in the threat model and fires on the same
--   tick, closing the grant -> first-tick window. See the seeding comment.
--   Verified column lifecycle on the local stack (admin.generateLink
--   email_change_new -> email_change set to the new address,
--   email_change_sent_at set; `email` unchanged until final confirm):
--     | leg                          | email | email_change | email_change_sent_at |
--     | request                      |  —    | new address  | set                  |
--     | first confirm                |  —    |  —           |  —                   |
--     | final confirm                | new   | cleared      |  —                   |
--     | password change w/ pending   |  —    | (stays set)  | NULLed               |
--
-- ── Revocation mechanism (empirically pinned) ──────────────────────────────
--   GoTrue's user-facing revokeGrant is user-JWT-scoped; a scheduled job has
--   no user JWT and GoTrue v2.183.0 exposes no admin equivalent. The job
--   replicates revokeGrant's effects directly in SQL. A real
--   `supabase.auth.oauth.revokeGrant({clientId})` observed on this stack:
--     - sets auth.oauth_consents.revoked_at = now() (row kept; re-consent
--       UN-revokes the SAME row, oauth_consent.go:158),
--     - deletes auth.sessions rows for the client (refresh_tokens cascade via
--       auth.refresh_tokens.session_id ON DELETE CASCADE),
--     - writes a `token_revoked` audit entry. Observed payload shape (copied
--       verbatim for parity so Supabase audit tooling sees job revocations
--       like user-initiated ones):
--         {"action":"token_revoked","actor_id":"<user>",
--          "actor_username":"<email>","actor_via_sso":false,
--          "log_type":"token",
--          "traits":{"action":"revoke_oauth_grant","oauth_client_id":"<uuid>"}}
--       (instance_id all-zeros, ip_address defaults to '').
--   After revoke, getUser(<oauth token>) returns "Auth session missing!"
--   within ms (verified). No DDL on auth-owned tables — the only auth writes
--   are the revocation UPDATE/DELETE and this data-row INSERT.
--
-- ── Lockdown discipline (repo patterns) ────────────────────────────────────
--   Every new public table: RLS enabled, no policies, privileges revoked from
--   public/anon/authenticated (20260502095010_lock_handicap_queue.sql). The
--   detection function: SECURITY DEFINER, SET search_path = '', EXECUTE
--   revoked from public/anon/authenticated (PUBLIC gets EXECUTE by default —
--   20260502104218 lesson). Cron setup mirrors setup_handicap_queue_cron().
-- ============================================================================

-- ── State tables (public; service-role-only) ───────────────────────────────

-- Ledger of every revocation the job performs.
CREATE TABLE IF NOT EXISTS public.oauth_auto_revocations (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  audit_entry_id   uuid,                 -- NULL for email-signal revocations
  signal           text NOT NULL,        -- 'audit:user_updated_password' | 'email_snapshot'
  user_id          uuid NOT NULL,
  oauth_client_id  uuid NOT NULL,
  sessions_deleted int  NOT NULL DEFAULT 0,
  detected_at      timestamptz NOT NULL DEFAULT now(),
  -- Dedupes the audit path (NULL audit_entry_id rows never collide, so the
  -- email path is free to insert repeatedly — it dedupes via the snapshot).
  CONSTRAINT oauth_auto_revocations_audit_client_uniq
    UNIQUE (audit_entry_id, oauth_client_id)
);

ALTER TABLE public.oauth_auto_revocations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.oauth_auto_revocations FROM authenticated, anon;
GRANT ALL ON TABLE public.oauth_auto_revocations TO service_role;

-- Temporal watermark for the audit scan (single row, k = 'audit').
CREATE TABLE IF NOT EXISTS public.oauth_watch_state (
  k                 text PRIMARY KEY,
  last_processed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.oauth_watch_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.oauth_watch_state FROM authenticated, anon;
GRANT ALL ON TABLE public.oauth_watch_state TO service_role;

-- Per-user snapshot of the watched email-change columns.
CREATE TABLE IF NOT EXISTS public.oauth_watch_email_state (
  user_id               uuid PRIMARY KEY,
  email                 text,
  email_change          text,
  email_change_sent_at  timestamptz,
  captured_at           timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.oauth_watch_email_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.oauth_watch_email_state FROM authenticated, anon;
GRANT ALL ON TABLE public.oauth_watch_email_state TO service_role;

-- ── Detection + revocation function ────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.detect_and_revoke_oauth_grants()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_watermark   timestamptz;
  v_hit         record;
  v_deleted     int;
  v_new_count   int := 0;
  v_username    text;
  v_summary     text := '';
  v_webhook     text;
  v_fire        boolean;
BEGIN
  -- ── Signal A: password audit scan (watermark-bounded) ──────────────────
  SELECT last_processed_at INTO v_watermark
  FROM public.oauth_watch_state WHERE k = 'audit';

  IF v_watermark IS NULL THEN
    -- First ever run: seed the watermark to now() so historical entries are
    -- not reprocessed. A 2-minute overlap window still catches anything that
    -- lands immediately after.
    INSERT INTO public.oauth_watch_state (k, last_processed_at)
    VALUES ('audit', now())
    ON CONFLICT (k) DO NOTHING;
    v_watermark := now();
  END IF;

  -- Scan window: created_at > watermark - 2min. The join to live OAuth
  -- sessions with `s.created_at < a.created_at` is LOAD-BEARING for
  -- loop-prevention: a session re-consented AFTER the password-change entry
  -- (created_at later) is excluded, so re-consent inside the overlap window
  -- yields 0 hits. It also encodes the threat model (a token leaked from a
  -- PRE-EXISTING grant). `payload` is json (not jsonb) — `->>` works.
  -- `actor_id` is the user id (verified). No created_at index on
  -- audit_log_entries -> this is a bounded sequential scan; acceptable at
  -- current scale (revisit tripwire in the plan: ~100ms sustained / ~5M rows).
  --
  -- The `actor_id ~* <uuid shape>` guard is LOAD-BEARING, not decoration.
  -- `(payload->>'actor_id')::uuid` throws on any non-uuid text, and the whole
  -- function body is ONE transaction — a throw rolls back the watermark
  -- advance below too, so the next tick re-reads the identical window and
  -- fails identically: a silent, permanent wedge of the control. The guard
  -- must sit in the WHERE (a restriction qual on `a` alone) rather than in
  -- the JOIN: restriction quals are applied at the scan node, strictly below
  -- the join node where the cast lives, so the cast provably never sees a row
  -- the guard rejected. (This is also why an unwatched action with a junk
  -- actor_id — e.g. a `login` row — cannot reach the cast: the action filter
  -- is a restriction qual too.) Skipping a malformed row costs at most one
  -- detection; throwing costs every future one.
  FOR v_hit IN
    SELECT DISTINCT
      s.user_id          AS user_id,
      s.oauth_client_id  AS oauth_client_id,
      a.id               AS audit_entry_id
    FROM auth.audit_log_entries a
    JOIN auth.sessions s
      ON s.user_id = (a.payload->>'actor_id')::uuid
     AND s.oauth_client_id IS NOT NULL
     AND s.created_at < a.created_at
    WHERE a.created_at > v_watermark - interval '2 minutes'
      AND a.payload->>'action' = 'user_updated_password'
      AND a.payload->>'actor_id' ~*
          '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  LOOP
    -- Gate FIRST (second line of defense behind the ordering predicate): the
    -- insert-time ON CONFLICT protects bookkeeping only; an ordered
    -- revoke-first would still re-DELETE without this pre-check.
    IF EXISTS (
      SELECT 1 FROM public.oauth_auto_revocations
      WHERE audit_entry_id = v_hit.audit_entry_id
        AND oauth_client_id = v_hit.oauth_client_id
    ) THEN
      CONTINUE;
    END IF;

    SELECT u.email INTO v_username
    FROM auth.users u WHERE u.id = v_hit.user_id;

    UPDATE auth.oauth_consents
       SET revoked_at = now()
     WHERE user_id = v_hit.user_id
       AND client_id = v_hit.oauth_client_id
       AND revoked_at IS NULL;

    DELETE FROM auth.sessions
     WHERE user_id = v_hit.user_id
       AND oauth_client_id = v_hit.oauth_client_id;
    GET DIAGNOSTICS v_deleted = ROW_COUNT;

    -- Parity token_revoked audit entry (shape pinned above). id has no
    -- default; ip_address takes its NOT NULL DEFAULT ''.
    INSERT INTO auth.audit_log_entries (id, instance_id, payload, created_at)
    VALUES (
      gen_random_uuid(),
      '00000000-0000-0000-0000-000000000000',
      json_build_object(
        'action', 'token_revoked',
        'actor_id', v_hit.user_id,
        'actor_username', v_username,
        'actor_via_sso', false,
        'log_type', 'token',
        'traits', json_build_object(
          'action', 'revoke_oauth_grant',
          'oauth_client_id', v_hit.oauth_client_id
        )
      ),
      now()
    );

    INSERT INTO public.oauth_auto_revocations
      (audit_entry_id, signal, user_id, oauth_client_id, sessions_deleted, detected_at)
    VALUES
      (v_hit.audit_entry_id, 'audit:user_updated_password',
       v_hit.user_id, v_hit.oauth_client_id, v_deleted, now())
    ON CONFLICT (audit_entry_id, oauth_client_id) DO NOTHING;

    v_new_count := v_new_count + 1;
    -- No PII in the alert body: user id + client id + signal only.
    v_summary := v_summary || format(
      E'\n- user=%s client=%s signal=audit:user_updated_password',
      v_hit.user_id, v_hit.oauth_client_id);
  END LOOP;

  -- Advance the watermark to now(). The 2-minute overlap re-scans recent
  -- entries next tick; re-seen entries are skipped by the ledger pre-check
  -- and the ordering predicate, so advancing to now() cannot drop a late
  -- commit (it re-enters the overlap window).
  UPDATE public.oauth_watch_state SET last_processed_at = now() WHERE k = 'audit';

  -- ── Signal B: email snapshot-compare over the live OAuth-session set ────
  FOR v_hit IN
    WITH live AS (
      SELECT user_id, min(created_at) AS first_session_at
      FROM auth.sessions
      WHERE oauth_client_id IS NOT NULL
      GROUP BY user_id
    )
    SELECT
      u.id                     AS user_id,
      u.email                  AS email,
      u.email_change           AS email_change,
      u.email_change_sent_at   AS email_change_sent_at,
      live.first_session_at    AS first_session_at,
      snap.user_id             AS snap_user_id,
      snap.email               AS snap_email,
      snap.email_change        AS snap_email_change,
      snap.email_change_sent_at AS snap_sent_at
    FROM live
    JOIN auth.users u ON u.id = live.user_id
    LEFT JOIN public.oauth_watch_email_state snap ON snap.user_id = u.id
  LOOP
    -- First sight of a user: seed the snapshot. Normally that is all — there
    -- is no prior state to compare against.
    --
    -- But seeding must NOT swallow a change that happened inside the
    -- grant -> first-tick window. A grant created between two ticks is first
    -- seen with whatever the email columns already say, so an email change
    -- driven by the leaked token in that sub-minute window would be baked
    -- into the seed and never fire — and Signal A does not cover it (GoTrue
    -- v2.183.0 emits no email-change audit action; that is why Signal B
    -- exists). So on first sight we apply the same ordering test Signal A
    -- uses (`s.created_at < a.created_at`): a change REQUESTED after the
    -- oldest live grant was created is in the threat model and fires.
    -- min(created_at) mirrors Signal A, which matches on ANY session older
    -- than the event. A change requested BEFORE the grant existed cannot
    -- have been driven by its token and is left alone.
    IF v_hit.snap_user_id IS NULL THEN
      INSERT INTO public.oauth_watch_email_state
        (user_id, email, email_change, email_change_sent_at, captured_at)
      VALUES
        (v_hit.user_id, v_hit.email, v_hit.email_change,
         v_hit.email_change_sent_at, now())
      ON CONFLICT (user_id) DO NOTHING;

      IF NOT (
        v_hit.email_change_sent_at IS NOT NULL
        AND v_hit.email_change_sent_at > v_hit.first_session_at
      ) THEN
        CONTINUE;
      END IF;

      v_fire := true;
    ELSE
      -- Trigger rules (precise — naive IS DISTINCT FROM false-triggers):
      --   (a) email differs                                 -> change completed
      --   (b) email_change is a DIFFERENT non-empty value   -> change requested
      --       (non-empty test is coalesce<>'' because the default is '')
      --   (c) email_change_sent_at makes a FORWARD move only (never on clearing
      --       — a password change with a pending email NULLs it while leaving
      --       email_change populated: null-ward transition must NOT fire)
      v_fire := (
          v_hit.email IS DISTINCT FROM v_hit.snap_email
        ) OR (
          coalesce(v_hit.email_change, '') <> ''
          AND v_hit.email_change IS DISTINCT FROM v_hit.snap_email_change
        ) OR (
          v_hit.email_change_sent_at IS NOT NULL
          AND (v_hit.snap_sent_at IS NULL OR v_hit.email_change_sent_at > v_hit.snap_sent_at)
        );
    END IF;

    IF v_fire THEN
      -- Revoke every live OAuth grant for this user.
      SELECT u.email INTO v_username FROM auth.users u WHERE u.id = v_hit.user_id;

      DECLARE
        v_client uuid;
      BEGIN
        FOR v_client IN
          SELECT DISTINCT oauth_client_id FROM auth.sessions
          WHERE user_id = v_hit.user_id AND oauth_client_id IS NOT NULL
        LOOP
          UPDATE auth.oauth_consents
             SET revoked_at = now()
           WHERE user_id = v_hit.user_id
             AND client_id = v_client
             AND revoked_at IS NULL;

          DELETE FROM auth.sessions
           WHERE user_id = v_hit.user_id AND oauth_client_id = v_client;
          GET DIAGNOSTICS v_deleted = ROW_COUNT;

          INSERT INTO auth.audit_log_entries (id, instance_id, payload, created_at)
          VALUES (
            gen_random_uuid(),
            '00000000-0000-0000-0000-000000000000',
            json_build_object(
              'action', 'token_revoked',
              'actor_id', v_hit.user_id,
              'actor_username', v_username,
              'actor_via_sso', false,
              'log_type', 'token',
              'traits', json_build_object(
                'action', 'revoke_oauth_grant',
                'oauth_client_id', v_client
              )
            ),
            now()
          );

          INSERT INTO public.oauth_auto_revocations
            (audit_entry_id, signal, user_id, oauth_client_id, sessions_deleted, detected_at)
          VALUES
            (NULL, 'email_snapshot', v_hit.user_id, v_client, v_deleted, now());

          v_new_count := v_new_count + 1;
          v_summary := v_summary || format(
            E'\n- user=%s client=%s signal=email_snapshot',
            v_hit.user_id, v_client);
        END LOOP;
      END;
    END IF;

    -- Upsert the snapshot to current values (after processing).
    UPDATE public.oauth_watch_email_state
       SET email = v_hit.email,
           email_change = v_hit.email_change,
           email_change_sent_at = v_hit.email_change_sent_at,
           captured_at = now()
     WHERE user_id = v_hit.user_id;
  END LOOP;

  -- Prune snapshot rows for users no longer holding a live OAuth session
  -- (keeps the table tiny; a re-consenting user is re-seeded fresh).
  DELETE FROM public.oauth_watch_email_state s
   WHERE NOT EXISTS (
     SELECT 1 FROM auth.sessions se
      WHERE se.user_id = s.user_id AND se.oauth_client_id IS NOT NULL
   );

  -- ── Alert (best-effort; must NOT roll back the revocations) ────────────
  IF v_new_count > 0 THEN
    SELECT decrypted_secret INTO v_webhook
    FROM vault.decrypted_secrets
    WHERE name = 'alerting_slack_webhook' LIMIT 1;

    IF v_webhook IS NULL THEN
      RAISE WARNING 'oauth auto-revoke: % grant(s) revoked but alerting_slack_webhook secret is absent%',
        v_new_count, v_summary;
    ELSE
      BEGIN
        PERFORM net.http_post(
          url := v_webhook,
          body := jsonb_build_object(
            'text',
            format('OAuth auto-revoke fired: %s grant(s) revoked.%s',
                   v_new_count, v_summary)
          ),
          headers := jsonb_build_object('Content-Type', 'application/json')
        );
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'oauth auto-revoke: alert post failed (revocations stand): %', SQLERRM;
      END;
    END IF;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.detect_and_revoke_oauth_grants() FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.detect_and_revoke_oauth_grants() IS
  'api-platform 009: every-minute detective control. Detects password-change (audit action user_updated_password) and email-change (auth.users column snapshot-compare) activity on users holding a live OAuth session, replicates GoTrue revokeGrant in SQL (consent revoked_at + session delete + parity token_revoked audit), and alerts via Slack. Pinned on GoTrue v2.183.0.';

-- ── Cron registration (mirrors setup_handicap_queue_cron) ──────────────────

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA cron;

CREATE OR REPLACE FUNCTION public.setup_detect_and_revoke_oauth_cron()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  BEGIN
    PERFORM cron.unschedule('detect-and-revoke-oauth-grants');
  EXCEPTION WHEN OTHERS THEN
    NULL;  -- not scheduled yet
  END;

  PERFORM cron.schedule(
    'detect-and-revoke-oauth-grants',
    '* * * * *',  -- every minute; "minutes-to-detection"
    'SELECT public.detect_and_revoke_oauth_grants();'
  );

  RAISE NOTICE 'detect-and-revoke-oauth-grants cron scheduled (every minute)';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.setup_detect_and_revoke_oauth_cron() FROM PUBLIC, anon, authenticated;

SELECT public.setup_detect_and_revoke_oauth_cron();
