-- ============================================
-- EMAIL SYNC TRIGGER FUNCTION
-- Purpose: Sync profile.email changes to auth.users.email atomically
-- Uses pg_net to call Supabase Auth Admin API
-- ============================================

-- Create trigger function
CREATE OR REPLACE FUNCTION public.sync_email_to_auth()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  auth_api_url TEXT;
  service_role_key TEXT;
  http_result JSONB;
  is_local BOOLEAN;
  payload JSONB;
BEGIN
  -- Only proceed if email actually changed
  IF NEW.email IS NOT DISTINCT FROM OLD.email THEN
    RETURN NEW;
  END IF;

  -- Detect environment
  BEGIN
    SELECT COUNT(*) > 0 INTO is_local
    FROM vault.decrypted_secrets
    WHERE name = 'SUPABASE_SERVICE_ROLE_KEY';
    is_local := NOT is_local;
  EXCEPTION
    WHEN OTHERS THEN
      is_local := TRUE;
  END;

  -- Set Auth API URL based on environment
  IF is_local THEN
    auth_api_url := 'http://host.docker.internal:54321/auth/v1/admin/users/' || NEW.id::text;
  ELSE
    -- Production: construct from Supabase project URL
    SELECT secret INTO auth_api_url
    FROM vault.decrypted_secrets
    WHERE name = 'SUPABASE_URL'
    ORDER BY created_at DESC
    LIMIT 1;

    IF auth_api_url IS NULL THEN
      RAISE EXCEPTION 'SUPABASE_URL not found in vault';
    END IF;

    auth_api_url := auth_api_url || '/auth/v1/admin/users/' || NEW.id::text;
  END IF;

  -- Build payload for Auth Admin API
  payload := jsonb_build_object(
    'email', NEW.email
  );

  -- Get service role key and make HTTP request
  IF is_local THEN
    -- Local development: use environment variable
    SELECT current_setting('app.supabase_service_role_key', true) INTO service_role_key;

    http_result := net.http_post(
      auth_api_url,
      payload,
      '{}'::jsonb,
      jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || COALESCE(service_role_key, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU')
      ),
      5000 -- 5 second timeout
    );
  ELSE
    -- Production: use vault
    SELECT secret INTO service_role_key
    FROM vault.decrypted_secrets
    WHERE name = 'SUPABASE_SERVICE_ROLE_KEY'
    ORDER BY created_at DESC
    LIMIT 1;

    IF service_role_key IS NULL THEN
      RAISE EXCEPTION 'SUPABASE_SERVICE_ROLE_KEY not found in vault';
    END IF;

    http_result := net.http_post(
      auth_api_url,
      payload,
      '{}'::jsonb,
      jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_role_key,
        'apikey', service_role_key
      ),
      5000 -- 5 second timeout
    );
  END IF;

  -- Check HTTP result status
  IF (http_result->>'status')::int NOT BETWEEN 200 AND 299 THEN
    RAISE EXCEPTION 'Failed to sync email to auth.users: % (status: %)',
      http_result->>'error',
      http_result->>'status';
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger on profile table
DROP TRIGGER IF EXISTS sync_email_to_auth_trigger ON public.profile;

CREATE TRIGGER sync_email_to_auth_trigger
  BEFORE UPDATE ON public.profile
  FOR EACH ROW
  WHEN (NEW.email IS DISTINCT FROM OLD.email)
  EXECUTE FUNCTION public.sync_email_to_auth();

-- Add comment for documentation
COMMENT ON FUNCTION public.sync_email_to_auth() IS
  'Automatically syncs profile.email changes to auth.users.email via Auth Admin API. Raises exception on failure to ensure atomicity.';
