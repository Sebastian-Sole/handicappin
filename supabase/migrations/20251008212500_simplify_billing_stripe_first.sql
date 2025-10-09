-- Migration: Simplify billing system to Stripe-first approach
-- Purpose: Remove complex local subscription tracking, use Stripe as single source of truth
--          Keep only stripe_customers table for basic customer mapping

-- Drop complex billing tables that are no longer needed
DROP TABLE IF EXISTS public.billing_subscriptions CASCADE;
DROP TABLE IF EXISTS public.billing_events CASCADE;

-- Drop RPC functions that are no longer needed
DROP FUNCTION IF EXISTS public.upsert_subscription(uuid, text, text, text, text, boolean);
DROP FUNCTION IF EXISTS public.get_user_subscription(uuid);

-- Keep only the essential stripe_customers table
-- This table already exists from previous migrations, so we just ensure it's clean
-- No changes needed to stripe_customers table structure

-- Add comment to document the new approach
COMMENT ON TABLE public.stripe_customers IS 'Minimal Stripe customer mapping. Access control queries Stripe directly for real-time subscription status.';
