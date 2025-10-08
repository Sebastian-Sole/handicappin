-- Migration: Move billing tables to public schema
-- Purpose: Resolve Supabase client limitations with custom schema RPC calls
-- Affected tables: billing.customers, billing.subscriptions, billing.events
-- Special considerations: Maintains RLS policies and security

-- Create tables in public schema
CREATE TABLE IF NOT EXISTS public.billing_customers (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.billing_subscriptions (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_subscription_id TEXT,
  plan TEXT NOT NULL,
  status TEXT NOT NULL,
  current_period_end TIMESTAMPTZ,
  is_lifetime BOOLEAN DEFAULT FALSE NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.billing_events (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID,
  type TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Enable RLS on all tables
ALTER TABLE public.billing_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for billing_customers
CREATE POLICY "Users can view their own customer record" ON public.billing_customers
  FOR SELECT TO authenticated
  USING (auth.uid()::uuid = user_id);

-- Create RLS policies for billing_subscriptions
CREATE POLICY "Users can view their own subscription" ON public.billing_subscriptions
  FOR SELECT TO authenticated
  USING (auth.uid()::uuid = user_id);

-- Create RLS policies for billing_events
CREATE POLICY "Service role can insert events" ON public.billing_events
  FOR INSERT TO service_role
  WITH CHECK (true);

-- Migrate data from billing schema to public schema (if tables exist)
DO $$
BEGIN
  -- Migrate customers
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'billing' AND table_name = 'customers') THEN
    INSERT INTO public.billing_customers (user_id, stripe_customer_id, created_at)
    SELECT user_id, stripe_customer_id, created_at
    FROM billing.customers
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  -- Migrate subscriptions
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'billing' AND table_name = 'subscriptions') THEN
    INSERT INTO public.billing_subscriptions (user_id, stripe_subscription_id, plan, status, current_period_end, is_lifetime, updated_at)
    SELECT user_id, stripe_subscription_id, plan, status, current_period_end, is_lifetime, updated_at
    FROM billing.subscriptions
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  -- Migrate events
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'billing' AND table_name = 'events') THEN
    INSERT INTO public.billing_events (id, user_id, type, payload, created_at)
    SELECT id, user_id, type, payload, created_at
    FROM billing.events
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

-- Update RPC functions to use public schema tables
CREATE OR REPLACE FUNCTION public.upsert_subscription(
  p_user_id UUID,
  p_stripe_subscription_id TEXT,
  p_plan TEXT,
  p_status TEXT,
  p_current_period_end TIMESTAMPTZ,
  p_is_lifetime BOOLEAN
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.billing_subscriptions (
    user_id,
    stripe_subscription_id,
    plan,
    status,
    current_period_end,
    is_lifetime,
    updated_at
  )
  VALUES (
    p_user_id,
    p_stripe_subscription_id,
    p_plan,
    p_status,
    p_current_period_end,
    p_is_lifetime,
    NOW()
  )
  ON CONFLICT (user_id)
  DO UPDATE SET
    stripe_subscription_id = EXCLUDED.stripe_subscription_id,
    plan = EXCLUDED.plan,
    status = EXCLUDED.status,
    current_period_end = EXCLUDED.current_period_end,
    is_lifetime = EXCLUDED.is_lifetime,
    updated_at = NOW();
END;
$$;

CREATE OR REPLACE FUNCTION public.get_user_subscription(p_user_id UUID)
RETURNS TABLE (
  user_id UUID,
  stripe_subscription_id TEXT,
  plan TEXT,
  status TEXT,
  current_period_end TIMESTAMPTZ,
  is_lifetime BOOLEAN,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.user_id,
    s.stripe_subscription_id,
    s.plan,
    s.status,
    s.current_period_end,
    s.is_lifetime,
    s.updated_at
  FROM public.billing_subscriptions s
  WHERE s.user_id = p_user_id;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.upsert_subscription TO service_role;
GRANT EXECUTE ON FUNCTION public.get_user_subscription TO authenticated;