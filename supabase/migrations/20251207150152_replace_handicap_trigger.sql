-- Drop the old HTTP-calling trigger and function
DROP TRIGGER IF EXISTS trigger_handicap_recalculation ON public.round;
DROP FUNCTION IF EXISTS public.notify_handicap_engine();

-- Create new lightweight trigger function that only enqueues users
CREATE OR REPLACE FUNCTION public.enqueue_handicap_calculation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  target_user_id UUID;
  event_type_value TEXT;
BEGIN
  -- Determine user_id and event type based on operation
  IF TG_OP = 'DELETE' THEN
    target_user_id := OLD."userId";
    event_type_value := 'round_delete';
  ELSE
    target_user_id := NEW."userId";
    IF TG_OP = 'INSERT' THEN
      event_type_value := 'round_insert';
    ELSE
      event_type_value := 'round_update';
    END IF;
  END IF;

  -- UPSERT into queue: if user already queued, just update timestamp
  -- This ensures only one entry per user regardless of how many rounds change
  INSERT INTO public.handicap_calculation_queue (
    user_id,
    event_type,
    last_updated
  )
  VALUES (
    target_user_id,
    event_type_value,
    NOW()
  )
  ON CONFLICT (user_id)
  DO UPDATE SET
    last_updated = NOW(),
    event_type = EXCLUDED.event_type,  -- Update to most recent event type
    status = 'pending',
    attempts = 0;

  -- Return appropriate value for trigger
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- Create the new trigger on round table
CREATE TRIGGER trigger_handicap_recalculation
  AFTER INSERT OR UPDATE OR DELETE ON public.round
  FOR EACH ROW
  EXECUTE FUNCTION public.enqueue_handicap_calculation();

-- Add comment for documentation
COMMENT ON FUNCTION public.enqueue_handicap_calculation() IS
  'Lightweight trigger that enqueues users for handicap recalculation. Uses UPSERT to ensure only one queue entry per user.';
