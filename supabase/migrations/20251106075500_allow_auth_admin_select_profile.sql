-- Migration: Allow supabase_auth_admin to SELECT from profile table
--
-- Problem: JWT hook runs as supabase_auth_admin, but RLS policies on profile table
-- only allow 'authenticated' role to view rows. This causes the hook to always see
-- "No profile found" even though the profile exists.
--
-- Solution: Add RLS policy that allows supabase_auth_admin to SELECT all rows
-- from the profile table. This is safe because:
-- 1. supabase_auth_admin is an internal service role, not exposed to users
-- 2. The JWT hook needs to read billing data to inject into tokens
-- 3. The hook only runs in the secure Supabase Auth context

-- Create policy allowing supabase_auth_admin to SELECT from profile
CREATE POLICY "Auth admin can read profiles for JWT hook"
  ON public.profile
  FOR SELECT
  TO supabase_auth_admin
  USING (true);  -- Allow reading all rows (hook needs any user's profile)

COMMENT ON POLICY "Auth admin can read profiles for JWT hook" ON public.profile IS
  'Allows supabase_auth_admin to read profile data for JWT Custom Access Token Hook. This is required because the hook runs as supabase_auth_admin and needs to query user billing information to inject into JWT claims.';
