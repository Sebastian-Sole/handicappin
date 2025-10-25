ALTER TABLE "profile" ALTER COLUMN "subscription_status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "profile" ALTER COLUMN "subscription_status" DROP NOT NULL;