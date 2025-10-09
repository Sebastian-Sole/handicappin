-- Migration: Update upsert_subscription RPC to handle null values properly
-- Purpose: Fix TypeScript compilation errors by making RPC function parameters nullable
--          This allows lifetime subscriptions and handles edge cases gracefully

-- Drop and recreate the RPC function with nullable parameters
drop function if exists public.upsert_subscription(uuid, text, text, text, timestamptz, boolean);

create or replace function public.upsert_subscription(
  p_user_id uuid,
  p_stripe_subscription_id text,
  p_plan text,
  p_status text,
  p_current_period_end timestamptz,
  p_is_lifetime boolean
)
returns void
language plpgsql
security definer
as $$
begin
  insert into public.billing_subscriptions (
    user_id,
    stripe_subscription_id,
    plan,
    status,
    current_period_end,
    is_lifetime,
    updated_at
  )
  values (
    p_user_id,
    p_stripe_subscription_id,
    p_plan,
    p_status,
    p_current_period_end,
    p_is_lifetime,
    now()
  )
  on conflict (user_id)
  do update set
    stripe_subscription_id = excluded.stripe_subscription_id,
    plan = excluded.plan,
    status = excluded.status,
    current_period_end = excluded.current_period_end,
    is_lifetime = excluded.is_lifetime,
    updated_at = now();
end;
$$;

-- Grant execute permissions
grant execute on function public.upsert_subscription to service_role;
