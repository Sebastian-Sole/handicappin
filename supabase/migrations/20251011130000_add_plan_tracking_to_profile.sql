-- Add plan selection tracking to profile table
ALTER TABLE profile
  ADD COLUMN IF NOT EXISTS rounds_used INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS plan_selected TEXT CHECK (plan_selected IN ('free', 'premium', 'unlimited')),
  ADD COLUMN IF NOT EXISTS plan_selected_at TIMESTAMPTZ;

-- Create index for plan queries (improves performance)
CREATE INDEX IF NOT EXISTS idx_profile_plan_selected ON profile(plan_selected);

-- Add comments for documentation
COMMENT ON COLUMN profile.rounds_used IS 'Tracks number of rounds used by free tier users (25 limit). Not incremented for paid users.';
COMMENT ON COLUMN profile.plan_selected IS 'Records which plan user selected during onboarding. Updated when plan changes via Stripe.';
COMMENT ON COLUMN profile.plan_selected_at IS 'Timestamp of when user selected or changed their plan.';
