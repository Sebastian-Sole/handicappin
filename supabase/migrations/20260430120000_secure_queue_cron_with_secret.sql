-- Secure the handicap queue cron call with a shared secret header.
--
-- Background: the `process-handicap-queue` Edge Function has
-- `verify_jwt = false` (config.toml) so the cron job can call it without an
-- auth token. That meant the only "auth" was the request body containing
-- `{ scheduled: true }` -- trivially forgeable by anyone with the public
-- Functions URL. The Edge Function now requires an `x-cron-secret` header to
-- match `HANDICAP_CRON_SECRET`; this migration updates the cron call so it
-- sends that header, sourced from Supabase Vault at execution time.
--
-- DEPLOYMENT (manual, not done by this migration):
--   1. Set HANDICAP_CRON_SECRET in Supabase project Edge Function secrets
--      (Dashboard -> Edge Functions -> Secrets) so the Edge Function runtime
--      can read it via Deno.env.get(...).
--   2. Create the matching secret in Supabase Vault. As the `postgres` role
--      in the SQL editor:
--        SELECT vault.create_secret('<same secret value>', 'handicap_cron_secret');
--      Or via Dashboard -> Settings -> Vault -> New secret (name:
--      "handicap_cron_secret"). Both values MUST match.
--   3. Apply this migration (supabase db push or via the migrations CI flow).
--   4. Deploy the Edge Function (supabase functions deploy
--      process-handicap-queue). Until the function is deployed AND vault
--      has the secret AND the migration has applied, the cron will return
--      403 -- safe failure direction.
--
-- Rotation:
--   Update both the Edge Function secret AND the Vault secret to the same
--   new value. The vault read happens at every cron tick so rotations
--   take effect on the next firing without re-running this migration.
--   Vault secrets can be updated in-place via:
--     SELECT vault.update_secret(
--       (SELECT id FROM vault.secrets WHERE name = 'handicap_cron_secret'),
--       '<new value>'
--     );

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
