CREATE TABLE "otp_verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"email" text NOT NULL,
	"otp_hash" text NOT NULL,
	"otp_type" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"verification_attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"verified_at" timestamp,
	"request_ip" text,
	"metadata" text
);
--> statement-breakpoint
CREATE INDEX "otp_verifications_email_type_idx" ON "otp_verifications" USING btree ("email","otp_type");--> statement-breakpoint
CREATE INDEX "otp_verifications_expires_at_idx" ON "otp_verifications" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "otp_verifications_user_id_idx" ON "otp_verifications" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "otp_verifications" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "No direct access to OTP verifications" ON "otp_verifications" AS PERMISSIVE FOR ALL TO "anon", "authenticated", public USING (false);
