-- Cross-platform billing: record WHICH provider bills the user's current
-- contract (decision ledger D-arch: the DB is the entitlement source of
-- truth; Stripe and Apple each own the contracts they bill).
--
-- profile.billing_provider:
--   'stripe' | 'apple' | NULL (no paid contract / never purchased)
-- Written ONLY by webhook/service paths — the user-facing UPDATE policy
-- pins it alongside the existing billing columns (same posture).

ALTER TABLE "profile" ADD COLUMN IF NOT EXISTS "billing_provider" text;
--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profile_billing_provider_check'
  ) THEN
    ALTER TABLE "profile" ADD CONSTRAINT "profile_billing_provider_check"
    CHECK (billing_provider IN ('stripe', 'apple'));
  END IF;
END $$;
--> statement-breakpoint

-- Backfill: every existing paid contract was billed by Stripe (the only
-- provider that has ever existed for this app). Free/plan-less users carry
-- NULL (no contract to attribute).
UPDATE "profile"
SET "billing_provider" = 'stripe'
WHERE "plan_selected" IN ('premium', 'unlimited', 'lifetime')
  AND "billing_provider" IS NULL;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_profile_billing_provider"
  ON "profile"("billing_provider");
--> statement-breakpoint

-- RLS: users must not self-modify billing_provider. Recreate the UPDATE
-- policy with the new column added to the pinned set (same IS NOT DISTINCT
-- FROM pattern as the existing billing columns).
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profile;
--> statement-breakpoint

CREATE POLICY "Users can update their own profile"
ON public.profile
FOR UPDATE
TO authenticated
USING (auth.uid()::uuid = id)
WITH CHECK (
  auth.uid()::uuid = id
  AND email IS NOT DISTINCT FROM (SELECT email FROM profile WHERE id = auth.uid())
  AND plan_selected IS NOT DISTINCT FROM (SELECT plan_selected FROM profile WHERE id = auth.uid())
  AND subscription_status IS NOT DISTINCT FROM (SELECT subscription_status FROM profile WHERE id = auth.uid())
  AND current_period_end IS NOT DISTINCT FROM (SELECT current_period_end FROM profile WHERE id = auth.uid())
  AND cancel_at_period_end IS NOT DISTINCT FROM (SELECT cancel_at_period_end FROM profile WHERE id = auth.uid())
  AND billing_version IS NOT DISTINCT FROM (SELECT billing_version FROM profile WHERE id = auth.uid())
  AND billing_provider IS NOT DISTINCT FROM (SELECT billing_provider FROM profile WHERE id = auth.uid())
);
--> statement-breakpoint

-- Per-provider out-of-order guard storage (handoff DoD #3): the RevenueCat
-- webhook must ignore events older than the last APPLIED event from the
-- same provider. webhook_events already provides idempotency; these two
-- nullable columns let it also carry the provider cursor
-- (max(event_time_ms) over success rows per user+provider). Existing
-- Stripe rows stay NULL — Stripe handler semantics are unchanged.
ALTER TABLE "webhook_events" ADD COLUMN IF NOT EXISTS "provider" text;
--> statement-breakpoint

ALTER TABLE "webhook_events" ADD COLUMN IF NOT EXISTS "event_time_ms" bigint;
--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'webhook_events_provider_check'
  ) THEN
    ALTER TABLE "webhook_events" ADD CONSTRAINT "webhook_events_provider_check"
    CHECK (provider IN ('stripe', 'apple'));
  END IF;
END $$;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_webhook_events_provider_cursor"
  ON "webhook_events"("user_id", "provider", "event_time_ms")
  WHERE status = 'success';
