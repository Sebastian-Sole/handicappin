-- Add holes_played column to round table
-- Default to 18 for existing rows since historically all rounds were 18-hole
ALTER TABLE "round" ADD COLUMN "holes_played" integer NOT NULL DEFAULT 18;