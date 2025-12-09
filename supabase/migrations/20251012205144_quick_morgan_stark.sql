-- Migration: Add subscription status tracking fields for JWT claims
-- These fields enable middleware to handle edge cases without DB queries

-- Add subscription status (active, past_due, canceled, etc.)
ALTER TABLE "profile" ADD COLUMN IF NOT EXISTS "subscription_status" text DEFAULT 'active' NOT NULL;
--> statement-breakpoint

-- Add subscription period end (bigint/integer for unix timestamp)
ALTER TABLE "profile" ADD COLUMN IF NOT EXISTS "current_period_end" bigint;
--> statement-breakpoint

-- Add cancel_at_period_end flag
ALTER TABLE "profile" ADD COLUMN IF NOT EXISTS "cancel_at_period_end" boolean DEFAULT false NOT NULL;
--> statement-breakpoint

-- Add billing version for deterministic staleness detection
ALTER TABLE "profile" ADD COLUMN IF NOT EXISTS "billing_version" integer DEFAULT 1 NOT NULL;
--> statement-breakpoint

-- Add check constraint for subscription_status
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profile_subscription_status_check'
  ) THEN
    ALTER TABLE "profile" ADD CONSTRAINT "profile_subscription_status_check"
    CHECK (subscription_status IN (
      'active',
      'trialing',
      'past_due',
      'canceled',
      'paused',
      'incomplete',
      'incomplete_expired',
      'unpaid'
    ));
  END IF;
END $$;
--> statement-breakpoint

-- Add index for performance
CREATE INDEX IF NOT EXISTS "idx_profile_subscription_status" ON "profile"("subscription_status");
--> statement-breakpoint

-- Update stripe_customers policies (cleanup from Drizzle changes)
DROP POLICY IF EXISTS "Users can view their own customer record" ON "stripe_customers" CASCADE;
--> statement-breakpoint
DROP POLICY IF EXISTS "Service role can manage customer records" ON "stripe_customers" CASCADE;
--> statement-breakpoint
DROP POLICY IF EXISTS "Users can view their own stripe customer" ON "stripe_customers" CASCADE;
--> statement-breakpoint
CREATE POLICY "Users can view their own stripe customer" ON "stripe_customers" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((auth.uid()::uuid = user_id));