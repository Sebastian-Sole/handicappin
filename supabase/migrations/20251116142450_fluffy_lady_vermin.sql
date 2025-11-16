-- Migration: Fix current_period_end to use bigint (Y2038 prevention)
-- This prevents overflow in year 2038 when unix timestamps exceed integer max

BEGIN;

-- Alter column from integer to bigint
-- Safe because:
-- 1. All existing values are NULL or valid small integers
-- 2. Bigint is backward compatible (can store all integer values)
ALTER TABLE "profile" ALTER COLUMN "current_period_end" SET DATA TYPE bigint;

-- Add comment for documentation
COMMENT ON COLUMN profile.current_period_end IS
  'Unix timestamp (seconds since epoch) of subscription period end. NULL for free/lifetime plans. Uses bigint to prevent Y2038 overflow.';

COMMIT;