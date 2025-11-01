-- Migration: Create public count functions for landing page statistics
-- Purpose: Allow anonymous users to view aggregated counts (users, rounds, courses)
--          without exposing any actual data from the tables
-- Security: Functions use SECURITY DEFINER to bypass RLS, but only return counts

-- Function to get public user count
-- Returns the total count of profiles, rounded to nearest 10 for display
create or replace function public.get_public_user_count()
returns integer
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  user_count integer;
begin
  -- Count all profiles, bypassing RLS via SECURITY DEFINER
  select count(*)::integer
  into user_count
  from public.profile;
  
  -- Round to nearest 10 for display purposes
  return (round(user_count / 10.0) * 10)::integer;
end;
$$;

-- Function to get public round count
-- Returns the total count of rounds, rounded to nearest 10 for display
create or replace function public.get_public_round_count()
returns integer
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  round_count integer;
begin
  -- Count all rounds, bypassing RLS via SECURITY DEFINER
  select count(*)::integer
  into round_count
  from public.round;
  
  -- Round to nearest 10 for display purposes
  return (round(round_count / 10.0) * 10)::integer;
end;
$$;

-- Function to get public course count
-- Returns the total count of courses, rounded to nearest 10 for display
create or replace function public.get_public_course_count()
returns integer
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  course_count integer;
begin
  -- Count all courses, bypassing RLS via SECURITY DEFINER
  select count(*)::integer
  into course_count
  from public.course;
  
  -- Round to nearest 10 for display purposes
  return (round(course_count / 10.0) * 10)::integer;
end;
$$;

-- Grant execute permissions to anonymous users
-- This allows unauthenticated visitors to call these functions
grant execute on function public.get_public_user_count() to anon;
grant execute on function public.get_public_round_count() to anon;
grant execute on function public.get_public_course_count() to anon;

-- Also grant to authenticated users for consistency
grant execute on function public.get_public_user_count() to authenticated;
grant execute on function public.get_public_round_count() to authenticated;
grant execute on function public.get_public_course_count() to authenticated;

-- Add comments explaining the security model
comment on function public.get_public_user_count() is 
  'Returns public user count for landing page. Uses SECURITY DEFINER to bypass RLS but only returns aggregate count, not individual data.';
comment on function public.get_public_round_count() is 
  'Returns public round count for landing page. Uses SECURITY DEFINER to bypass RLS but only returns aggregate count, not individual data.';
comment on function public.get_public_course_count() is 
  'Returns public course count for landing page. Uses SECURITY DEFINER to bypass RLS but only returns aggregate count, not individual data.';

