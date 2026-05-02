-- Patch: re-apply setup_handicap_queue_cron() with SET search_path = ''.
--
-- Background:
--   The original migration (20260430120000_secure_queue_cron_with_secret.sql)
--   declared the function as SECURITY DEFINER but did not set a search_path.
--   Without an explicit search_path, an attacker who can create an object in
--   a schema searched ahead of `public` (or who can manipulate the caller's
--   search_path) could shadow built-in operators or functions and hijack
--   execution inside a SECURITY DEFINER function.
--
--   The function body uses fully-qualified references for everything that
--   isn't in `pg_catalog` (cron.unschedule, cron.schedule,
--   vault.decrypted_secrets, net.http_post, pg_settings is in pg_catalog,
--   format/jsonb_build_object/current_setting/NOW are in pg_catalog), so
--   `SET search_path = ''` is safe and changes no observable behavior.
--
--   The original migration has already been applied to prod, so editing it
--   in place won't auto-reapply. This patch migration re-runs the
--   CREATE OR REPLACE so prod picks up the search_path fix on the next
--   `db push`. The function is then invoked once so the cron schedule is
--   recreated with the patched function definition.

CREATE OR REPLACE FUNCTION setup_handicap_queue_cron()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  is_local boolean;
  cron_url text;
BEGIN
  is_local := current_setting('listen_addresses', true) IN ('*', '0.0.0.0')
    AND NOT EXISTS(
      SELECT 1 FROM pg_settings
      WHERE name = 'ssl' AND setting = 'on'
    );

  BEGIN
    PERFORM cron.unschedule('process-handicap-queue');
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  IF is_local THEN
    cron_url := 'http://host.docker.internal:54321/functions/v1/process-handicap-queue';
  ELSE
    cron_url := 'https://lssnaapatrurmhbbqadb.supabase.co/functions/v1/process-handicap-queue';
  END IF;

  -- Schedule the cron job with the shared-secret header.
  -- The secret is resolved at execution time via Supabase Vault
  -- (vault.decrypted_secrets) so it is never persisted in the cron.job table.
  -- If the secret is missing the subquery returns NULL -> header is null ->
  -- the Edge Function returns 403 (safe failure direction).
  PERFORM cron.schedule(
    'process-handicap-queue',
    '* * * * *',
    format(
      $cron$SELECT net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'handicap_cron_secret' LIMIT 1)
        ),
        body := jsonb_build_object('scheduled', true, 'timestamp', NOW())
      )$cron$,
      cron_url
    )
  );

  RAISE NOTICE 'Handicap queue cron job scheduled for % environment (with x-cron-secret header)',
    CASE WHEN is_local THEN 'LOCAL' ELSE 'PRODUCTION' END;
END;
$$;

SELECT setup_handicap_queue_cron();
