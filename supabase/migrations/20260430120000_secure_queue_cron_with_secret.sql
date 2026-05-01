-- Secure the handicap queue cron call with a shared secret header.
--
-- Background: the `process-handicap-queue` Edge Function has
-- `verify_jwt = false` (config.toml) so the cron job can call it without an
-- auth token. That meant the only "auth" was the request body containing
-- `{ scheduled: true }` -- trivially forgeable by anyone with the public
-- Functions URL. The Edge Function now requires an `x-cron-secret` header to
-- match `HANDICAP_CRON_SECRET`; this migration updates the cron call so it
-- sends that header, sourced from a Postgres setting at execution time.
--
-- DEPLOYMENT (manual, not done by this migration):
--   1. Set `HANDICAP_CRON_SECRET` in Supabase project secrets so the Edge
--      Function runtime can read it via `Deno.env.get(...)`.
--   2. Run, as a Supabase project superuser:
--        ALTER DATABASE postgres SET app.handicap_cron_secret = '<same secret>';
--      The `current_setting('app.handicap_cron_secret', true)` lookup below
--      uses the `missing_ok = true` second arg so it returns NULL (not an
--      error) until that ALTER DATABASE has been applied. While the setting
--      is NULL the cron call will fail auth at the Edge Function (403),
--      which is the safe failure mode.

CREATE OR REPLACE FUNCTION setup_handicap_queue_cron()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
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
  -- The secret is resolved at execution time via current_setting(..., true)
  -- so it is never persisted in the cron.job table.
  PERFORM cron.schedule(
    'process-handicap-queue',
    '* * * * *',
    format(
      $cron$SELECT net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', current_setting('app.handicap_cron_secret', true)
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
