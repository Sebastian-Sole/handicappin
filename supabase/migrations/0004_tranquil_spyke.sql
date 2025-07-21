ALTER TABLE "profile" ALTER COLUMN "handicapIndex" SET DEFAULT 54;--> statement-breakpoint
ALTER TABLE "profile" ALTER COLUMN "initialHandicapIndex" SET DEFAULT 54;--> statement-breakpoint
ALTER TABLE "round" ALTER COLUMN "exceptionalScoreAdjustment" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "profile" ADD COLUMN "createdAt" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL;