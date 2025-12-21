-- Create OTP verifications table for email/signup verification
CREATE TABLE IF NOT EXISTS "otp_verifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid,
  "email" text NOT NULL,
  "otp_hash" text NOT NULL,
  "otp_type" text NOT NULL CHECK (otp_type IN ('signup', 'email_change', 'password_reset')),
  "expires_at" timestamptz NOT NULL,
  "verified" boolean DEFAULT false NOT NULL,
  "verification_attempts" integer DEFAULT 0 NOT NULL,
  "created_at" timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "verified_at" timestamptz,
  "request_ip" text,
  "metadata" text
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS "otp_verifications_email_type_idx" ON "otp_verifications" USING btree ("email","otp_type");
CREATE INDEX IF NOT EXISTS "otp_verifications_expires_at_idx" ON "otp_verifications" USING btree ("expires_at");

-- Cleanup function: Delete expired OTPs older than 24 hours (run via cron or pg_cron)
CREATE OR REPLACE FUNCTION cleanup_expired_otps()
RETURNS void AS $$
BEGIN
  DELETE FROM otp_verifications
  WHERE expires_at < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comment explaining the table
COMMENT ON TABLE "otp_verifications" IS 'Stores one-time passwords for email verification, password reset, and email change flows';
