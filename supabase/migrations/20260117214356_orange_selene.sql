-- Migration: Add tee rating columns and holes_played to round table
-- Purpose:
--   1. Store course rating and slope rating at time of play (preserves historical calculations)
--   2. Add holes_played column to track 9 vs 18 hole rounds
--   3. Fix 9-hole rounds to use front9 ratings per USGA Rule 5.1b
--   4. Recalculate scoreDifferential for legacy 9-hole rounds (were using incorrect 18-hole ratings)

-- ============================================================
-- PHASE 1: Add new columns as nullable (to allow backfill)
-- ============================================================

-- Tee ratings locked at time of play
ALTER TABLE "round" ADD COLUMN "course_rating_used" numeric;--> statement-breakpoint
ALTER TABLE "round" ADD COLUMN "slope_rating_used" integer;--> statement-breakpoint

-- Track number of holes played (9 or 18)
ALTER TABLE "round" ADD COLUMN "holes_played" integer NOT NULL DEFAULT 18;--> statement-breakpoint

-- ============================================================
-- PHASE 2: Backfill holes_played by counting scores per round
-- ============================================================

-- Count actual scores for each round to determine holes played
UPDATE "round" r
SET "holes_played" = (
  SELECT count(*)
  FROM "score" s
  WHERE s."roundId" = r.id
);--> statement-breakpoint

-- ============================================================
-- PHASE 3: Backfill ratings based on holes played
-- Use 18-hole ratings for 18-hole rounds
-- Use front9 ratings for 9-hole rounds (per USGA Rule 5.1b)
-- ============================================================

-- Backfill 18-hole rounds with 18-hole ratings
UPDATE "round" r
SET
  "course_rating_used" = t."courseRating18",
  "slope_rating_used" = t."slopeRating18"
FROM "teeInfo" t
WHERE r."teeId" = t.id
  AND r."holes_played" = 18;--> statement-breakpoint

-- Backfill 9-hole rounds with front9 ratings (USGA Rule 5.1b)
-- NOTE: This is a one-time backfill for legacy data.
-- We use current tee ratings since historical ratings weren't stored.
-- Going forward, rounds store ratings at submission time.
UPDATE "round" r
SET
  "course_rating_used" = t."courseRatingFront9",
  "slope_rating_used" = t."slopeRatingFront9"
FROM "teeInfo" t
WHERE r."teeId" = t.id
  AND r."holes_played" = 9;--> statement-breakpoint

-- Recalculate scoreDifferential for 9-hole rounds using front9 ratings
-- The original scoreDifferential was calculated with 18-hole ratings (incorrect)
-- Formula: (adjustedGrossScore - courseRating) * 113 / slopeRating
UPDATE "round" r
SET
  "scoreDifferential" = ("adjustedGrossScore" - t."courseRatingFront9") * 113.0 / t."slopeRatingFront9"
FROM "teeInfo" t
WHERE r."teeId" = t.id
  AND r."holes_played" = 9;--> statement-breakpoint

-- ============================================================
-- PHASE 4: Make columns non-null after backfill
-- ============================================================

ALTER TABLE "round" ALTER COLUMN "course_rating_used" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "round" ALTER COLUMN "slope_rating_used" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "round" ALTER COLUMN "holes_played" SET NOT NULL;--> statement-breakpoint

-- ============================================================
-- PHASE 5: Queue handicap recalculation for users with 9-hole rounds
-- These rounds now have different stored ratings and need recalculation
-- ============================================================

-- Insert into handicap calculation queue for affected users
-- On conflict: reset attempts and error_message since this is a new event type
INSERT INTO "handicap_calculation_queue" ("user_id", "event_type", "status")
SELECT DISTINCT r."userId", 'nine_hole_rating_fix', 'pending'
FROM "round" r
WHERE r."holes_played" = 9
ON CONFLICT ("user_id") DO UPDATE
SET
  "event_type" = 'nine_hole_rating_fix',
  "last_updated" = CURRENT_TIMESTAMP,
  "status" = 'pending',
  "attempts" = 0,
  "error_message" = NULL;--> statement-breakpoint

-- ============================================================
-- PHASE 6: Add comments for documentation
-- ============================================================

COMMENT ON COLUMN "round"."course_rating_used" IS 'Course rating at time round was played. For 9-hole rounds, stores front9 rating per USGA Rule 5.1b.';--> statement-breakpoint
COMMENT ON COLUMN "round"."slope_rating_used" IS 'Slope rating at time round was played. For 9-hole rounds, stores front9 slope per USGA Rule 5.1b.';--> statement-breakpoint
COMMENT ON COLUMN "round"."holes_played" IS 'Number of holes played in this round (9 or 18). Used to determine which ratings and calculation formula to use.';
