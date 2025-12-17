CREATE TABLE "email_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"feature_updates" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "email_preferences_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "email_preferences" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "email_preferences" ADD CONSTRAINT "email_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profile"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE POLICY "Users can view their own email preferences" ON "email_preferences" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((auth.uid()::uuid = user_id));--> statement-breakpoint
CREATE POLICY "Users can insert their own email preferences" ON "email_preferences" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((auth.uid()::uuid = user_id));--> statement-breakpoint
CREATE POLICY "Users can update their own email preferences" ON "email_preferences" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((auth.uid()::uuid = user_id));--> statement-breakpoint
CREATE POLICY "Users can delete their own email preferences" ON "email_preferences" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((auth.uid()::uuid = user_id));