-- Migration: Move billing tables from billing schema to public schema
-- Purpose: Resolve Supabase client limitations with custom schemas
--          Move billing.customers, billing.subscriptions, billing.events to public schema
--          Update RPC functions to work with public schema tables

-- Drop existing RPC functions that reference billing schema
drop function if exists public.upsert_subscription(uuid, text, text, text, timestamptz, boolean);
drop function if exists public.get_user_subscription(uuid);

-- Create tables in public schema (if they don't exist)
create table if not exists public.billing_customers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text unique not null,
  created_at timestamp with time zone default current_timestamp not null
);

create table if not exists public.billing_subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_subscription_id text,
  plan text not null,
  status text not null,
  current_period_end timestamp with time zone,
  is_lifetime boolean default false not null,
  updated_at timestamp with time zone default current_timestamp not null
);

create table if not exists public.billing_events (
  id serial primary key,
  user_id uuid references auth.users(id) on delete cascade,
  type text not null,
  payload text not null,
  created_at timestamp with time zone default current_timestamp not null
);

-- Enable RLS on all tables
alter table public.billing_customers enable row level security;
alter table public.billing_subscriptions enable row level security;
alter table public.billing_events enable row level security;

-- Create RLS policies for billing_customers
create policy "Users can view their own customer record" on public.billing_customers
  for select to authenticated
  using (auth.uid()::uuid = user_id);

create policy "Service role can manage customer records" on public.billing_customers
  for all to service_role
  using (true);

-- Create RLS policies for billing_subscriptions
create policy "Users can view their own subscription" on public.billing_subscriptions
  for select to authenticated
  using (auth.uid()::uuid = user_id);

create policy "Service role can manage subscriptions" on public.billing_subscriptions
  for all to service_role
  using (true);

-- Create RLS policies for billing_events
create policy "Service role can insert events" on public.billing_events
  for insert to service_role
  with check (true);

create policy "Users can view their own events" on public.billing_events
  for select to authenticated
  using (auth.uid()::uuid = user_id);

-- Migrate data from billing schema to public schema (if billing tables exist)
insert into public.billing_customers (user_id, stripe_customer_id, created_at)
select user_id, stripe_customer_id, created_at
from billing.customers
on conflict (user_id) do nothing;

insert into public.billing_subscriptions (user_id, stripe_subscription_id, plan, status, current_period_end, is_lifetime, updated_at)
select user_id, stripe_subscription_id, plan, status, current_period_end, is_lifetime, updated_at
from billing.subscriptions
on conflict (user_id) do nothing;

insert into public.billing_events (user_id, type, payload, created_at)
select user_id, type, payload, created_at
from billing.events
on conflict do nothing;

-- Create RPC function for subscription upserts (now using public schema)
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

-- Create RPC function for getting user subscription (now using public schema)
create or replace function public.get_user_subscription(p_user_id uuid)
returns table(
  user_id uuid,
  stripe_subscription_id text,
  plan text,
  status text,
  current_period_end timestamp,
  is_lifetime boolean,
  updated_at timestamp
)
language plpgsql
security definer
as $$
begin
  return query
  select 
    s.user_id,
    s.stripe_subscription_id,
    s.plan,
    s.status,
    s.current_period_end::timestamp,
    s.is_lifetime,
    s.updated_at::timestamp
  from public.billing_subscriptions s
  where s.user_id = p_user_id;
end;
$$;

-- Grant execute permissions
grant execute on function public.upsert_subscription to service_role;
grant execute on function public.get_user_subscription to authenticated, service_role;
