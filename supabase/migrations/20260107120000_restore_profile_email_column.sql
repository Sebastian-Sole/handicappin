-- ============================================
-- RESTORE EMAIL COLUMN TO PROFILE TABLE
-- Adds email back to profile table and backfills from auth.users
-- This is needed after removing email was determined to cause O(N) performance issues
-- ============================================

-- Step 1: Add email column (nullable initially for safe backfill)
ALTER TABLE public.profile ADD COLUMN IF NOT EXISTS email text;

-- Step 2: Backfill existing profiles with email from auth.users
UPDATE public.profile
SET email = auth.users.email
FROM auth.users
WHERE profile.id = auth.users.id
  AND profile.email IS NULL;

-- Step 3: Make email NOT NULL (now that all existing rows are populated)
ALTER TABLE public.profile ALTER COLUMN email SET NOT NULL;

-- Step 4: Create unique index on email for O(1) lookups
CREATE UNIQUE INDEX IF NOT EXISTS profile_email_key ON public.profile USING btree (email text_ops);

-- Step 5: Update the RLS policy to prevent email changes
-- Drop existing update policy
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profile;

-- Recreate with email protection
CREATE POLICY "Users can update their own profile" 
  ON public.profile 
  AS PERMISSIVE 
  FOR UPDATE 
  TO authenticated 
  USING (auth.uid()::uuid = id)
  WITH CHECK (
    auth.uid()::uuid = id
    AND email IS NOT DISTINCT FROM (SELECT email FROM profile WHERE id = auth.uid())
    AND plan_selected IS NOT DISTINCT FROM (SELECT plan_selected FROM profile WHERE id = auth.uid())
    AND subscription_status IS NOT DISTINCT FROM (SELECT subscription_status FROM profile WHERE id = auth.uid())
    AND current_period_end IS NOT DISTINCT FROM (SELECT current_period_end FROM profile WHERE id = auth.uid())
    AND cancel_at_period_end IS NOT DISTINCT FROM (SELECT cancel_at_period_end FROM profile WHERE id = auth.uid())
    AND billing_version IS NOT DISTINCT FROM (SELECT billing_version FROM profile WHERE id = auth.uid())
  );

-- Comment for documentation
COMMENT ON COLUMN public.profile.email IS 
  'User email address. Restored after O(N) performance issues with listUsers() calls. Must match auth.users.email.';
