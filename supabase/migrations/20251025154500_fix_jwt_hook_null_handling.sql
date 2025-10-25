-- Migration: Fix JWT Hook to Properly Handle NULL plan_selected
--
-- Problem: The JWT hook was using COALESCE to default NULL plan_selected to 'free'
-- This prevented middleware from detecting users who haven't selected a plan
--
-- Fix: Remove COALESCE for plan_selected and subscription_status
-- Allow NULL values to pass through to JWT claims

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER  -- Required to access profile table from auth context
SET search_path = public  -- Prevent search_path attacks
STABLE  -- Function doesn't modify database
AS $$
DECLARE
  original_claims jsonb;
  new_claims jsonb;
  claim text;
  rec record;
  app_meta jsonb;
BEGIN
  -- Get original claims from event
  original_claims := event->'claims';
  new_claims := '{}'::jsonb;

  -- Preserve all standard JWT claims (as per Supabase docs)
  FOREACH claim IN ARRAY ARRAY[
    'iss',
    'aud',
    'exp',
    'iat',
    'sub',
    'role',
    'aal',
    'session_id',
    'email',
    'phone',
    'is_anonymous',
    'amr',
    'user_metadata'
  ] LOOP
    IF original_claims ? claim THEN
      new_claims := jsonb_set(new_claims, ARRAY[claim], original_claims->claim);
    END IF;
  END LOOP;

  -- Get user's MINIMAL billing information from profile table
  -- NOTE: No COALESCE on plan_selected or subscription_status
  -- This allows NULL to pass through, which middleware uses to detect
  -- users who haven't completed onboarding
  SELECT
    plan_selected::text AS plan,  -- NULL if no plan selected
    subscription_status::text AS status,  -- NULL if no plan selected
    current_period_end,  -- NULL for free/lifetime
    COALESCE(cancel_at_period_end, false)::boolean AS cancel_at_period_end,
    COALESCE(billing_version, 1)::integer AS billing_version
  INTO rec
  FROM public.profile
  WHERE id = (event->>'user_id')::uuid;

  -- Handle missing profile (shouldn't happen, but be defensive)
  IF NOT FOUND THEN
    rec.plan := NULL;  -- No plan for missing profile
    rec.status := NULL;  -- No status for missing profile
    rec.current_period_end := NULL;
    rec.cancel_at_period_end := false;
    rec.billing_version := 0;
  END IF;

  -- Build app_metadata with billing information
  -- Start with existing app_metadata if present, otherwise empty object
  IF original_claims ? 'app_metadata' THEN
    app_meta := original_claims->'app_metadata';
  ELSE
    app_meta := '{}'::jsonb;
  END IF;

  -- Add billing to app_metadata
  app_meta := jsonb_set(
    app_meta,
    '{billing}',
    jsonb_build_object(
      'plan', rec.plan,
      'status', rec.status,
      'current_period_end', rec.current_period_end,
      'cancel_at_period_end', rec.cancel_at_period_end,
      'billing_version', rec.billing_version
    )
  );

  -- Set the complete app_metadata back into claims
  new_claims := jsonb_set(new_claims, '{app_metadata}', app_meta);

  -- Return event with modified claims
  RETURN jsonb_build_object('claims', new_claims);
END;
$$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO supabase_auth_admin;
GRANT SELECT ON public.profile TO supabase_auth_admin;

-- Revoke from public for security
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) FROM PUBLIC;

-- Add comment for documentation
COMMENT ON FUNCTION public.custom_access_token_hook IS
  'Custom Access Token Hook: Injects MINIMAL billing information from profile table into JWT claims. Allows NULL plan/status for users who have not completed onboarding. Runs automatically on token issue/refresh. SECURITY DEFINER with safe search_path.';
