CREATE TABLE "course" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"approvalStatus" text DEFAULT 'pending' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "course" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "hole" (
	"id" serial PRIMARY KEY NOT NULL,
	"teeId" integer NOT NULL,
	"holeNumber" integer NOT NULL,
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
	"handicapIndex" numeric DEFAULT 54 NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"initialHandicapIndex" numeric DEFAULT 54 NOT NULL,
	"createdAt" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE "profile" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "round" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" uuid NOT NULL,
	"courseId" integer NOT NULL,
	"teeId" integer NOT NULL,
	"teeTime" timestamp NOT NULL,
	"totalStrokes" integer NOT NULL,
	"parPlayed" integer NOT NULL,
	"adjustedGrossScore" integer NOT NULL,
	"adjustedPlayedScore" integer NOT NULL,
	"courseHandicap" integer NOT NULL,
	"scoreDifferential" numeric NOT NULL,
	"existingHandicapIndex" numeric NOT NULL,
	"updatedHandicapIndex" numeric NOT NULL,
	"exceptionalScoreAdjustment" numeric DEFAULT 0 NOT NULL,
	"notes" text,
	"approvalStatus" text DEFAULT 'pending' NOT NULL,
	"createdAt" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE "round" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "score" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" uuid NOT NULL,
	"roundId" integer NOT NULL,
	"holeId" integer NOT NULL,
	"strokes" integer NOT NULL,
	"hcpStrokes" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "score" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "teeInfo" (
	"id" serial PRIMARY KEY NOT NULL,
	"courseId" integer NOT NULL,
	"name" text NOT NULL,
	"gender" text NOT NULL,
	"courseRating18" numeric NOT NULL,
	"slopeRating18" integer NOT NULL,
	"courseRatingFront9" numeric NOT NULL,
	"slopeRatingFront9" integer NOT NULL,
	"courseRatingBack9" numeric NOT NULL,
	"slopeRatingBack9" integer NOT NULL,
	"outPar" integer NOT NULL,
	"inPar" integer NOT NULL,
	"totalPar" integer NOT NULL,
	"outDistance" integer NOT NULL,
	"inDistance" integer NOT NULL,
	"totalDistance" integer NOT NULL,
	"distanceMeasurement" text DEFAULT 'yards' NOT NULL,
	"approvalStatus" text DEFAULT 'pending' NOT NULL,
	"isArchived" boolean DEFAULT false NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "teeInfo" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
-- CREATE TABLE "auth"."users" (
-- 	"id" uuid PRIMARY KEY NOT NULL
-- );
--> statement-breakpoint
ALTER TABLE "hole" ADD CONSTRAINT "hole_teeId_fkey" FOREIGN KEY ("teeId") REFERENCES "public"."teeInfo"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "profile" ADD CONSTRAINT "profile_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "round" ADD CONSTRAINT "round_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "public"."course"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "round" ADD CONSTRAINT "round_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."profile"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "round" ADD CONSTRAINT "round_teeId_fkey" FOREIGN KEY ("teeId") REFERENCES "public"."teeInfo"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "score" ADD CONSTRAINT "score_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "public"."round"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "score" ADD CONSTRAINT "score_holeId_fkey" FOREIGN KEY ("holeId") REFERENCES "public"."hole"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "score" ADD CONSTRAINT "score_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."profile"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "teeInfo" ADD CONSTRAINT "teeInfo_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "public"."course"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "course_name_key" ON "course" USING btree ("name" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "profile_email_key" ON "profile" USING btree ("email" text_ops);--> statement-breakpoint
CREATE POLICY "Authenticated users can view courses" ON "course" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "Authenticated users can view holes" ON "hole" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "Users can view their own profile" ON "profile" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((auth.uid()::uuid = id));--> statement-breakpoint
CREATE POLICY "Users can update their own profile" ON "profile" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((auth.uid()::uuid = id));--> statement-breakpoint
CREATE POLICY "Users can insert their own profile" ON "profile" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((auth.uid()::uuid = id));--> statement-breakpoint
CREATE POLICY "Users can delete their own profile" ON "profile" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((auth.uid()::uuid = id));--> statement-breakpoint
CREATE POLICY "Users can view their own rounds" ON "round" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((auth.uid()::uuid = "userId"));--> statement-breakpoint
CREATE POLICY "Users can insert their own rounds" ON "round" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((auth.uid()::uuid = "userId"));--> statement-breakpoint
CREATE POLICY "Users can update their own rounds" ON "round" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((auth.uid()::uuid = "userId"));--> statement-breakpoint
CREATE POLICY "Users can delete their own rounds" ON "round" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((auth.uid()::uuid = "userId"));--> statement-breakpoint
CREATE POLICY "Users can view their own scores" ON "score" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((auth.uid()::uuid = "userId"));--> statement-breakpoint
CREATE POLICY "Users can insert their own scores" ON "score" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((auth.uid()::uuid = "userId"));--> statement-breakpoint
CREATE POLICY "Users can update their own scores" ON "score" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((auth.uid()::uuid = "userId"));--> statement-breakpoint
CREATE POLICY "Users can delete their own scores" ON "score" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((auth.uid()::uuid = "userId"));--> statement-breakpoint
CREATE POLICY "Authenticated users can view tee info" ON "teeInfo" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);