-- Enable Realtime for profile table
-- This allows clients to subscribe to profile table changes via WebSocket

-- Add profile table to the Realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE profile;

-- Set replica identity to FULL to get both old and new values in change events
-- This is necessary to detect billing_version changes (compare old vs new)
ALTER TABLE profile REPLICA IDENTITY FULL;

-- Note: No RLS changes needed - Realtime subscriptions already respect RLS
-- Users can only subscribe to their own profile due to existing RLS policies
