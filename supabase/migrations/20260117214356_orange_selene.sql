-- Migration: Add tee rating columns to round table
-- Purpose: Store course rating and slope rating at time of play
-- This preserves historical handicap calculations even if tee data changes later

-- Step 1: Add columns as nullable first (to allow backfill)
ALTER TABLE "round" ADD COLUMN "course_rating_used" numeric;--> statement-breakpoint
ALTER TABLE "round" ADD COLUMN "slope_rating_used" integer;--> statement-breakpoint

-- Step 2: Backfill existing rounds from their linked tee
UPDATE "round" r
SET
  "course_rating_used" = t."courseRating18",
  "slope_rating_used" = t."slopeRating18"
FROM "teeInfo" t
WHERE r."teeId" = t.id;--> statement-breakpoint

-- Step 3: Make columns non-null after backfill
ALTER TABLE "round" ALTER COLUMN "course_rating_used" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "round" ALTER COLUMN "slope_rating_used" SET NOT NULL;--> statement-breakpoint

-- Step 4: Add comments for documentation
COMMENT ON COLUMN "round"."course_rating_used" IS 'Course rating at time round was played. Preserved even if tee ratings change later.';--> statement-breakpoint
COMMENT ON COLUMN "round"."slope_rating_used" IS 'Slope rating at time round was played. Preserved even if tee ratings change later.';
