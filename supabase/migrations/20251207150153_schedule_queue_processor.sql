-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA cron;

-- Create function to set up the cron job based on environment
CREATE OR REPLACE FUNCTION setup_handicap_queue_cron()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  is_local boolean;
  cron_url text;
  auth_header jsonb;
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

  -- Set URL and auth based on environment
  IF is_local THEN
    -- Local development configuration
    cron_url := 'http://host.docker.internal:54321/functions/v1/process-handicap-queue';
    auth_header := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
    );
  ELSE
    -- Production configuration
    cron_url := 'https://lssnaapatrurmhbbqadb.supabase.co/functions/v1/process-handicap-queue';

    -- Use the service role key from Supabase vault
    -- Supabase automatically stores this in vault.decrypted_secrets
    DECLARE
      vault_key TEXT;
    BEGIN
      SELECT decrypted_secret INTO vault_key
      FROM vault.decrypted_secrets
      WHERE name = 'SUPABASE_SERVICE_ROLE_KEY'
      LIMIT 1;

      auth_header := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || vault_key
      );
    EXCEPTION WHEN OTHERS THEN
      -- If vault doesn't work, try database setting as fallback
      BEGIN
        auth_header := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
        );
      EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'Could not find service role key in vault or database settings';
      END;
    END;
  END IF;

  -- Schedule the cron job
  PERFORM cron.schedule(
    'process-handicap-queue',
    '* * * * *',  -- Every minute
    format(
      'SELECT net.http_post(url := %L, headers := %L::jsonb, body := %L::jsonb)',
      cron_url,
      auth_header,
      jsonb_build_object('scheduled', true, 'timestamp', NOW())
    )
  );

  RAISE NOTICE 'Handicap queue cron job scheduled for % environment',
    CASE WHEN is_local THEN 'LOCAL' ELSE 'PRODUCTION' END;
END;
$$;

-- Call the setup function
SELECT setup_handicap_queue_cron();

-- Add comment for documentation
COMMENT ON EXTENSION pg_cron IS 'Scheduled job processor for handicap calculation queue';
COMMENT ON FUNCTION setup_handicap_queue_cron() IS 'Sets up the handicap queue processor cron job, automatically detecting local vs production environment';
