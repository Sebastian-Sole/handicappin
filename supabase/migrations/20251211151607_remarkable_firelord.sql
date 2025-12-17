CREATE TABLE "pending_email_changes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"old_email" text NOT NULL,
	"new_email" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"request_ip" text,
	"verification_attempts" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "pending_email_changes_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "pending_email_changes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "pending_email_changes" ADD CONSTRAINT "pending_email_changes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profile"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "pending_email_changes_token_hash_idx" ON "pending_email_changes" USING btree ("token_hash");--> statement-breakpoint
CREATE POLICY "Users can view their own pending email changes" ON "pending_email_changes" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((auth.uid()::uuid = user_id));