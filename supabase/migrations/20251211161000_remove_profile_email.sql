-- ============================================
-- REMOVE EMAIL FROM PROFILE TABLE
-- Make auth.users the single source of truth for email
-- ============================================

-- Drop the trigger first (it depends on the email column)
DROP TRIGGER IF EXISTS sync_email_to_auth_trigger ON public.profile;

-- Drop the unique index on email (if it exists)
DROP INDEX IF EXISTS profile_email_key;

-- Now we can drop the email column
ALTER TABLE public.profile DROP COLUMN IF EXISTS email;

-- Drop email_updated_at since we're removing email tracking from profile
ALTER TABLE public.profile DROP COLUMN IF EXISTS email_updated_at;

-- Comment for documentation
COMMENT ON TABLE public.profile IS
  'User profile data. Email is stored in auth.users table only - join with auth.users for email access.';
