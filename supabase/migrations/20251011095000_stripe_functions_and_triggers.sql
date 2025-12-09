-- Migration: Stripe Functions and Triggers
-- Purpose: Add database functions and triggers needed for Stripe integration
--          This complements the Drizzle-generated schema with business logic
--          Note: RLS policies for stripe_customers are created in the main migration

-- ============================================
-- HANDICAP ENGINE TRIGGER FUNCTION
-- ============================================

-- Create debug log table for production
CREATE TABLE IF NOT EXISTS public.trigger_debug_log (
  id SERIAL PRIMARY KEY,
  op TEXT NOT NULL,
  round_id INTEGER,
  user_id UUID,
  approval_status TEXT,
  payload JSONB,
  service_role_key_prefix TEXT,
  http_post_result JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create the handicap engine trigger function
CREATE OR REPLACE FUNCTION public.notify_handicap_engine()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  url TEXT;
  payload JSONB;
  service_role_key TEXT;
  http_result JSONB;
  round_id INTEGER;  -- Changed from UUID to match round.id type
  user_id UUID;
  approval_status TEXT;
  is_local BOOLEAN;
BEGIN
  -- Detect if we're in local development by checking if we can access vault.decrypted_secrets
  -- In local development, this table doesn't exist or is empty
  BEGIN
    SELECT COUNT(*) > 0 INTO is_local
    FROM vault.decrypted_secrets
    WHERE name = 'SUPABASE_SERVICE_ROLE_KEY';

    -- If we can't access the table or it's empty, we're likely in local development
    is_local := NOT is_local;
  EXCEPTION
    WHEN OTHERS THEN
      -- If we can't access vault.decrypted_secrets, we're in local development
      is_local := TRUE;
  END;

  -- Set URL based on environment
  IF is_local THEN
    url := 'http://host.docker.internal:54321/functions/v1/handicap-engine';
  ELSE
    -- Production: get URL from vault to avoid hardcoding in repo
    SELECT secret INTO url
    FROM vault.decrypted_secrets
    WHERE name = 'HANDICAP_ENGINE_URL'
    ORDER BY created_at DESC
    LIMIT 1;

    -- Fallback or validation
    IF url IS NULL THEN
      RAISE EXCEPTION 'HANDICAP_ENGINE_URL not found in vault.decrypted_secrets';
    END IF;
  END IF;

  -- Determine whether to use NEW or OLD depending on operation
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    round_id := NEW.id;
    user_id := NEW."userId";
    approval_status := NEW."approvalStatus";
  ELSE
    round_id := OLD.id;
    user_id := OLD."userId";
    approval_status := OLD."approvalStatus";
  END IF;

  -- Construct payload in Supabase webhook format
  IF TG_OP = 'INSERT' THEN
    payload := jsonb_build_object(
      'type', 'INSERT',
      'table', 'round',
      'schema', 'public',
      'record', to_jsonb(NEW),
      'old_record', null
    );
  ELSIF TG_OP = 'UPDATE' THEN
    payload := jsonb_build_object(
      'type', 'UPDATE',
      'table', 'round',
      'schema', 'public',
      'record', to_jsonb(NEW),
      'old_record', to_jsonb(OLD)
    );
  ELSE -- DELETE
    payload := jsonb_build_object(
      'type', 'DELETE',
      'table', 'round',
      'schema', 'public',
      'record', null,
      'old_record', to_jsonb(OLD)
    );
  END IF;

  -- In local development, skip service role key lookup
  IF is_local THEN
    -- For local development, call without auth
    http_result := net.http_post(
      url,
      payload,
      '{}'::jsonb,
      jsonb_build_object('Content-Type', 'application/json')
    );
  ELSE
    -- Production: use service role key from vault
    SELECT secret INTO service_role_key
    FROM vault.decrypted_secrets
    WHERE name = 'SUPABASE_SERVICE_ROLE_KEY'
    ORDER BY created_at DESC
    LIMIT 1;

    -- Raise error if key is missing
    IF service_role_key IS NULL THEN
      RAISE EXCEPTION 'Service Role Key not found in vault.decrypted_secrets';
    END IF;

    -- Call Edge Function using pg_net with auth
    http_result := net.http_post(
      url,
      payload,
      '{}'::jsonb,
      jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_role_key
      )
    );

    -- Log to debug table (only in production)
    INSERT INTO public.trigger_debug_log (
      op,
      round_id,
      user_id,
      approval_status,
      payload,
      service_role_key_prefix,
      http_post_result
    )
    VALUES (
      TG_OP,
      round_id,
      user_id,
      approval_status,
      payload,
      LEFT(service_role_key, 8) || '...',  -- don't log full key for security
      http_result
    );
  END IF;

  -- Return appropriate value
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- Create the trigger
DROP TRIGGER IF EXISTS trigger_handicap_recalculation ON public.round;
CREATE TRIGGER trigger_handicap_recalculation
  AFTER INSERT OR UPDATE OR DELETE ON public.round
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_handicap_engine();

-- ============================================
-- APPROVAL STATUS CASCADE TRIGGERS
-- ============================================

-- Function to handle approval status cascading to rounds
-- This function checks if a round's course and tee are both approved, and if so, approves the round
CREATE OR REPLACE FUNCTION public.cascade_approval_to_rounds()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  affected_rounds_count integer;
BEGIN
  -- Only proceed if the approval status was changed to 'approved'
  IF new."approvalStatus" = 'approved' AND (old."approvalStatus" IS NULL OR old."approvalStatus" != 'approved') THEN
    
    IF tg_table_name = 'course' THEN
      -- Course was approved: update rounds where both course and tee are approved
      UPDATE public.round 
      SET "approvalStatus" = 'approved'
      WHERE "courseId" = new.id
        AND "approvalStatus" != 'approved'
        AND "teeId" IN (
          SELECT t.id 
          FROM public."teeInfo" t 
          WHERE t."approvalStatus" = 'approved'
        );
      
      GET DIAGNOSTICS affected_rounds_count = row_count;
      
      -- Log the operation for debugging (optional)
      IF affected_rounds_count > 0 THEN
        RAISE NOTICE 'Course % approved: automatically approved % rounds', new.name, affected_rounds_count;
      END IF;
      
    ELSIF tg_table_name = 'teeInfo' THEN
      -- Tee was approved: update rounds where both course and tee are approved
      UPDATE public.round 
      SET "approvalStatus" = 'approved'
      WHERE "teeId" = new.id
        AND "approvalStatus" != 'approved'
        AND "courseId" IN (
          SELECT c.id 
          FROM public.course c 
          WHERE c."approvalStatus" = 'approved'
        );
      
      GET DIAGNOSTICS affected_rounds_count = row_count;
      
      -- Log the operation for debugging (optional)
      IF affected_rounds_count > 0 THEN
        RAISE NOTICE 'Tee % approved: automatically approved % rounds', new.name, affected_rounds_count;
      END IF;
      
    END IF;
  END IF;
  
  RETURN new;
END;
$$;

-- Create trigger on course table
-- Fires after update to check if course approval should cascade to rounds
DROP TRIGGER IF EXISTS trigger_course_approval_cascade ON public.course;
CREATE TRIGGER trigger_course_approval_cascade
  AFTER UPDATE ON public.course
  FOR EACH ROW
  WHEN (new."approvalStatus" = 'approved' AND old."approvalStatus" != 'approved')
  EXECUTE FUNCTION public.cascade_approval_to_rounds();

-- Create trigger on teeInfo table  
-- Fires after update to check if tee approval should cascade to rounds
DROP TRIGGER IF EXISTS trigger_tee_approval_cascade ON public."teeInfo";
CREATE TRIGGER trigger_tee_approval_cascade
  AFTER UPDATE ON public."teeInfo"
  FOR EACH ROW
  WHEN (new."approvalStatus" = 'approved' AND old."approvalStatus" != 'approved')
  EXECUTE FUNCTION public.cascade_approval_to_rounds();

-- ============================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================

-- Add comment to document the Stripe-first approach
COMMENT ON TABLE public.stripe_customers IS 'Minimal Stripe customer mapping. Access control queries Stripe directly for real-time subscription status.';