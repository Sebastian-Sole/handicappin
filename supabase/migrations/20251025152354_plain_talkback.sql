-- Allow subscription_status to be NULL for profiles without active subscriptions
-- This enables flexible Stripe integration and handling of subscription state transitions
ALTER TABLE "profile" ALTER COLUMN "subscription_status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "profile" ALTER COLUMN "subscription_status" DROP NOT NULL;