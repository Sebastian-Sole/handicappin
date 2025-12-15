-- Add proper authentication to handicap queue cron job
-- This fixes the security vulnerability where the endpoint could be called by anyone
-- with a simple JSON body containing { "scheduled": true }

CREATE OR REPLACE FUNCTION setup_handicap_queue_cron()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  is_local boolean;
  cron_url text;
  service_role_key text;
BEGIN
  -- Detect environment by checking the database host
  -- Local Supabase uses 'postgres' or has specific local indicators
  -- Production uses AWS/cloud hostnames
  is_local := current_setting('listen_addresses', true) IN ('*', '0.0.0.0')
    AND NOT EXISTS(
      SELECT 1 FROM pg_settings
      WHERE name = 'ssl' AND setting = 'on'
    );

  -- Get service role key from vault (must be configured in Supabase secrets)
  -- For local development, you may need to set this manually in .env
  BEGIN
    SELECT decrypted_secret INTO service_role_key
    FROM vault.decrypted_secrets
    WHERE name = 'service_role_key'
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    -- Vault not available or secret not configured
    -- Try to get from pg_settings as fallback (if configured)
    BEGIN
      service_role_key := current_setting('app.settings.service_role_key', true);
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'Service role key not found in vault.decrypted_secrets or app.settings. Please configure the service_role_key secret in Supabase Vault.';
    END;
  END;

  IF service_role_key IS NULL OR service_role_key = '' THEN
    RAISE EXCEPTION 'Service role key is empty. Please configure the service_role_key secret in Supabase Vault.';
  END IF;

  -- Remove existing job if it exists (suppress errors if not found)
  BEGIN
    PERFORM cron.unschedule('process-handicap-queue');
  EXCEPTION WHEN OTHERS THEN
    -- Job doesn't exist yet, that's fine
    NULL;
  END;

  -- Set URL based on environment
  IF is_local THEN
    -- Local development configuration
    cron_url := 'http://host.docker.internal:54321/functions/v1/process-handicap-queue';
  ELSE
    -- Production configuration
    cron_url := 'https://lssnaapatrurmhbbqadb.supabase.co/functions/v1/process-handicap-queue';
  END IF;

  -- Schedule the cron job WITH proper authentication
  -- The Edge Function will verify the Authorization header
  PERFORM cron.schedule(
    'process-handicap-queue',
    '* * * * *',  -- Every minute
    format(
      $cron$SELECT net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || %L
        ),
        body := jsonb_build_object('timestamp', NOW())
      )$cron$,
      cron_url,
      service_role_key
    )
  );

  RAISE NOTICE 'Handicap queue cron job scheduled for % environment with authentication',
    CASE WHEN is_local THEN 'LOCAL' ELSE 'PRODUCTION' END;
END;
$$;

-- Re-run the setup to apply changes and update the existing cron job
SELECT setup_handicap_queue_cron();
