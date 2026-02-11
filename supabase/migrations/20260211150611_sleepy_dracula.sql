CREATE TABLE "legal_consents" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid,
	"consent_type" text NOT NULL,
	"legal_version" text NOT NULL,
	"accepted_at" timestamp with time zone NOT NULL,
	"withdrawn_at" timestamp with time zone,
	"ip_address" text,
	"acceptance_method" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE "legal_consents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "legal_consents" ADD CONSTRAINT "legal_consents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profile"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "idx_legal_consents_user_id" ON "legal_consents" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_legal_consents_user_consent_type" ON "legal_consents" USING btree ("user_id","consent_type");--> statement-breakpoint
CREATE POLICY "Users can view their own legal consents" ON "legal_consents" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((select auth.uid()) = user_id));
