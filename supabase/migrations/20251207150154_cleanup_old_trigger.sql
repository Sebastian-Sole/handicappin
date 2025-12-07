-- Remove old debug table (no longer needed)
DROP TABLE IF EXISTS public.trigger_debug_log;

-- Verify old function is removed (should already be gone from Phase 2)
-- Note: We do NOT drop the trigger here because it's the NEW trigger!
DROP FUNCTION IF EXISTS public.notify_handicap_engine();

-- Add final comment for documentation
COMMENT ON TABLE public.handicap_calculation_queue IS
  'Queue-based handicap calculation system. Users are enqueued when rounds change. Processed every minute by scheduled Edge Function. Replaces legacy HTTP webhook trigger.';

COMMENT ON FUNCTION public.enqueue_handicap_calculation() IS
  'Enqueues users for handicap recalculation when rounds change. Uses UPSERT to coalesce multiple changes per user into single queue entry.';
