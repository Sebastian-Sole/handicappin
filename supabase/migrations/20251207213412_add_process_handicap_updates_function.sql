-- Create function to atomically update rounds, profile, and queue in a single transaction
CREATE OR REPLACE FUNCTION process_handicap_updates(
  round_updates JSONB,
  user_id UUID,
  new_handicap_index NUMERIC,
  queue_job_id BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  round_update JSONB;
  updated_count INT := 0;
BEGIN
  -- Update all rounds from the JSONB array
  FOR round_update IN SELECT * FROM jsonb_array_elements(round_updates)
  LOOP
    UPDATE round
    SET
      "existingHandicapIndex" = (round_update->>'existingHandicapIndex')::NUMERIC,
      "scoreDifferential" = (round_update->>'scoreDifferential')::NUMERIC,
      "updatedHandicapIndex" = (round_update->>'updatedHandicapIndex')::NUMERIC,
      "exceptionalScoreAdjustment" = (round_update->>'exceptionalScoreAdjustment')::NUMERIC,
      "adjustedGrossScore" = (round_update->>'adjustedGrossScore')::INTEGER,
      "courseHandicap" = (round_update->>'courseHandicap')::INTEGER,
      "adjustedPlayedScore" = (round_update->>'adjustedPlayedScore')::INTEGER
    WHERE id = (round_update->>'id')::INTEGER;

    updated_count := updated_count + 1;
  END LOOP;

  -- Update user's final handicap index
  UPDATE profile
  SET "handicapIndex" = new_handicap_index
  WHERE id = user_id;

  -- Delete job from queue (success)
  DELETE FROM handicap_calculation_queue
  WHERE id = queue_job_id;

  -- Return success with count of updated rounds
  RETURN jsonb_build_object(
    'success', true,
    'rounds_updated', updated_count
  );
EXCEPTION
  WHEN OTHERS THEN
    -- On any error, transaction will rollback automatically
    RAISE EXCEPTION 'Failed to process handicap updates: %', SQLERRM;
END;
$$;

-- Grant execute permission to authenticated users and service role
GRANT EXECUTE ON FUNCTION process_handicap_updates(JSONB, UUID, NUMERIC, BIGINT) TO authenticated, service_role;

-- Create function to handle users with no approved rounds
CREATE OR REPLACE FUNCTION process_handicap_no_rounds(
  user_id UUID,
  max_handicap NUMERIC,
  queue_job_id BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
BEGIN
  -- Update user's handicap to maximum
  UPDATE profile
  SET "handicapIndex" = max_handicap
  WHERE id = user_id;

  -- Delete job from queue (success)
  DELETE FROM handicap_calculation_queue
  WHERE id = queue_job_id;

  -- Return success
  RETURN jsonb_build_object(
    'success', true,
    'message', 'No approved rounds, handicap set to maximum'
  );
EXCEPTION
  WHEN OTHERS THEN
    -- On any error, transaction will rollback automatically
    RAISE EXCEPTION 'Failed to process handicap (no rounds): %', SQLERRM;
END;
$$;

-- Grant execute permission to authenticated users and service role
GRANT EXECUTE ON FUNCTION process_handicap_no_rounds(UUID, NUMERIC, BIGINT) TO authenticated, service_role;
