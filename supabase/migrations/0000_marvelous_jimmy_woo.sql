CREATE TABLE "course" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"approval_status" text DEFAULT 'pending' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "course" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "hole" (
	"id" serial PRIMARY KEY NOT NULL,
	"tee_id" integer NOT NULL,
	"hole_number" integer NOT NULL,
	"par" integer NOT NULL,
	"distance" integer NOT NULL,
	"hcp" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "hole" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "profile" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"handicap_index" numeric DEFAULT '0' NOT NULL,
	"verified" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "profile" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "round" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"course_id" integer NOT NULL,
	"tee_id" integer NOT NULL,
	"tee_time" timestamp NOT NULL,
	"total_strokes" integer NOT NULL,
	"par_played" integer NOT NULL,
	"adjusted_gross_score" integer NOT NULL,
	"adjusted_played_score" integer NOT NULL,
	"course_handicap" integer NOT NULL,
	"score_differential" numeric NOT NULL,
	"existing_handicap_index" numeric NOT NULL,
	"updated_handicap_index" numeric NOT NULL,
	"exceptional_score_adjustment" numeric DEFAULT '0' NOT NULL,
	"notes" text,
	"approval_status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE "round" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "score" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"round_id" integer NOT NULL,
	"hole_id" integer NOT NULL,
	"strokes" integer NOT NULL,
	"hcp_strokes" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "score" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "tee_info" (
	"id" serial PRIMARY KEY NOT NULL,
	"course_id" integer NOT NULL,
	"name" text NOT NULL,
	"gender" text NOT NULL,
	"course_rating_18" numeric NOT NULL,
	"slope_rating_18" integer NOT NULL,
	"course_rating_front_9" numeric NOT NULL,
	"slope_rating_front_9" integer NOT NULL,
	"course_rating_back_9" numeric NOT NULL,
	"slope_rating_back_9" integer NOT NULL,
	"out_par" integer NOT NULL,
	"in_par" integer NOT NULL,
	"total_par" integer NOT NULL,
	"out_distance" integer NOT NULL,
	"in_distance" integer NOT NULL,
	"total_distance" integer NOT NULL,
	"distance_measurement" text DEFAULT 'yards' NOT NULL,
	"approval_status" text DEFAULT 'pending' NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tee_info" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
-- CREATE TABLE "auth"."users" (
-- 	"id" uuid PRIMARY KEY NOT NULL
-- );
--> statement-breakpoint
ALTER TABLE "hole" ADD CONSTRAINT "hole_tee_id_fkey" FOREIGN KEY ("tee_id") REFERENCES "public"."tee_info"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "profile" ADD CONSTRAINT "profile_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "round" ADD CONSTRAINT "round_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."course"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "round" ADD CONSTRAINT "round_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profile"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "round" ADD CONSTRAINT "round_tee_id_fkey" FOREIGN KEY ("tee_id") REFERENCES "public"."tee_info"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "score" ADD CONSTRAINT "score_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "public"."round"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "score" ADD CONSTRAINT "score_hole_id_fkey" FOREIGN KEY ("hole_id") REFERENCES "public"."hole"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "score" ADD CONSTRAINT "score_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profile"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "tee_info" ADD CONSTRAINT "tee_info_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."course"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "course_name_key" ON "course" USING btree ("name" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "profile_email_key" ON "profile" USING btree ("email" text_ops);--> statement-breakpoint
CREATE POLICY "Authenticated users can view courses" ON "course" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "Authenticated users can view holes" ON "hole" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "Users can view their own profile" ON "profile" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((auth.uid()::uuid = id));--> statement-breakpoint
CREATE POLICY "Users can update their own profile" ON "profile" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((auth.uid()::uuid = id));--> statement-breakpoint
CREATE POLICY "Users can insert their own profile" ON "profile" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((auth.uid()::uuid = id));--> statement-breakpoint
CREATE POLICY "Users can delete their own profile" ON "profile" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((auth.uid()::uuid = id));--> statement-breakpoint
CREATE POLICY "Users can view their own rounds" ON "round" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((auth.uid()::uuid = "user_id"));--> statement-breakpoint
CREATE POLICY "Users can insert their own rounds" ON "round" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((auth.uid()::uuid = "user_id"));--> statement-breakpoint
CREATE POLICY "Users can update their own rounds" ON "round" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((auth.uid()::uuid = "user_id"));--> statement-breakpoint
CREATE POLICY "Users can delete their own rounds" ON "round" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((auth.uid()::uuid = "user_id"));--> statement-breakpoint
CREATE POLICY "Users can view their own scores" ON "score" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((auth.uid()::uuid = "user_id"));--> statement-breakpoint
CREATE POLICY "Users can insert their own scores" ON "score" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((auth.uid()::uuid = "user_id"));--> statement-breakpoint
CREATE POLICY "Users can update their own scores" ON "score" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((auth.uid()::uuid = "user_id"));--> statement-breakpoint
CREATE POLICY "Users can delete their own scores" ON "score" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((auth.uid()::uuid = "user_id"));--> statement-breakpoint
CREATE POLICY "Authenticated users can view tee info" ON "tee_info" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);