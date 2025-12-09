-- Update the cron setup function with better environment detection
-- This replaces the previous version to properly detect local vs production

CREATE OR REPLACE FUNCTION setup_handicap_queue_cron()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  is_local boolean;
  cron_url text;
BEGIN
  -- Detect environment by checking the database host
  -- Local Supabase uses 'postgres' or has specific local indicators
  -- Production uses AWS/cloud hostnames
  is_local := current_setting('listen_addresses', true) IN ('*', '0.0.0.0')
    AND NOT EXISTS(
      SELECT 1 FROM pg_settings
      WHERE name = 'ssl' AND setting = 'on'
    );

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

  -- Schedule the cron job
  -- SECURITY: Construct auth header at execution time to avoid persisting credentials in cron.job table
  PERFORM cron.schedule(
    'process-handicap-queue',
    '* * * * *',  -- Every minute
    format(
      $cron$SELECT net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
        ),
        body := jsonb_build_object('scheduled', true, 'timestamp', NOW())
      )$cron$,
      cron_url
    )
  );

  RAISE NOTICE 'Handicap queue cron job scheduled for % environment',
    CASE WHEN is_local THEN 'LOCAL' ELSE 'PRODUCTION' END;
END;
$$;

-- Re-run the setup to apply changes
SELECT setup_handicap_queue_cron();
