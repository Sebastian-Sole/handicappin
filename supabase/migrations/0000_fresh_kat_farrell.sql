CREATE TABLE "Course" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"isApproved" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "Course" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "Hole" (
	"id" serial PRIMARY KEY NOT NULL,
	"teeId" integer NOT NULL,
	"holeNumber" integer NOT NULL,
	"par" integer NOT NULL,
	"hcp" integer NOT NULL,
	"length" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "Hole" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "Profile" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"handicapIndex" double precision NOT NULL,
	"verified" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "Profile" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "Round" (
	"id" serial PRIMARY KEY NOT NULL,
	"teeTime" timestamp NOT NULL,
	"courseId" integer NOT NULL,
	"userId" uuid NOT NULL,
	"teeId" integer NOT NULL,
	"existingHandicapIndex" double precision NOT NULL,
	"updatedHandicapIndex" double precision DEFAULT 0 NOT NULL,
	"scoreDifferential" double precision NOT NULL,
	"totalStrokes" integer NOT NULL,
	"adjustedGrossScore" integer NOT NULL,
	"createdAt" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"parPlayed" integer NOT NULL,
	"notes" text,
	"exceptionalScoreAdjustment" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "Round" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "Score" (
	"id" serial PRIMARY KEY NOT NULL,
	"roundId" integer NOT NULL,
	"holeId" integer NOT NULL,
	"strokes" integer NOT NULL,
	"hcpStrokes" integer DEFAULT 0 NOT NULL,
	"userId" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "Score" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "TeeInfo" (
	"id" serial PRIMARY KEY NOT NULL,
	"courseId" integer NOT NULL,
	"name" text NOT NULL,
	"gender" text NOT NULL,
	"courseRating" double precision NOT NULL,
	"slopeRating" double precision NOT NULL,
	"totalPar" integer NOT NULL,
	"outPar" integer NOT NULL,
	"inPar" integer NOT NULL,
	"totalDistance" integer NOT NULL,
	"outDistance" integer NOT NULL,
	"inDistance" integer NOT NULL,
	"distanceMeasurement" text NOT NULL,
	"handicaps" integer[] NOT NULL,
	"distances" integer[] NOT NULL,
	"pars" integer[] NOT NULL,
	"isApproved" boolean DEFAULT false NOT NULL,
	"isArchived" boolean DEFAULT false NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "TeeInfo" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "auth"."users" (
	"id" uuid PRIMARY KEY NOT NULL
);
--> statement-breakpoint
ALTER TABLE "Hole" ADD CONSTRAINT "Hole_teeId_fkey" FOREIGN KEY ("teeId") REFERENCES "public"."TeeInfo"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Round" ADD CONSTRAINT "Round_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "public"."Course"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Round" ADD CONSTRAINT "Round_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."Profile"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Round" ADD CONSTRAINT "Round_teeId_fkey" FOREIGN KEY ("teeId") REFERENCES "public"."TeeInfo"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Score" ADD CONSTRAINT "Score_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "public"."Round"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Score" ADD CONSTRAINT "Score_holeId_fkey" FOREIGN KEY ("holeId") REFERENCES "public"."Hole"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Score" ADD CONSTRAINT "Score_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."Profile"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "TeeInfo" ADD CONSTRAINT "TeeInfo_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "public"."Course"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "Course_name_key" ON "Course" USING btree ("name" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "Profile_email_key" ON "Profile" USING btree ("email" text_ops);--> statement-breakpoint
CREATE POLICY "Enable insert for authenticated users only" ON "Course" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "Enable read access for all users" ON "Course" AS PERMISSIVE FOR SELECT TO "authenticated";--> statement-breakpoint
CREATE POLICY "Enable insert for authenticated users only" ON "Hole" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "Enable read access for all users" ON "Hole" AS PERMISSIVE FOR SELECT TO "authenticated";--> statement-breakpoint
CREATE POLICY "Allow profile updates for authed users" ON "Profile" AS PERMISSIVE FOR UPDATE TO public USING ((auth.uid() = id));--> statement-breakpoint
CREATE POLICY "Enable delete for users based on their own user_id" ON "Profile" AS PERMISSIVE FOR DELETE TO public USING ((auth.uid() = id));--> statement-breakpoint
CREATE POLICY "Enable insert for authenticated users only" ON "Profile" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "Enable users to view their own data only" ON "Profile" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((auth.uid() = id));--> statement-breakpoint
CREATE POLICY "Enable insert for users based on userId" ON "Round" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((( SELECT auth.uid()) = "userId"));--> statement-breakpoint
CREATE POLICY "Enable users to view their own data only" ON "Round" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((( SELECT auth.uid()) = "userId"));--> statement-breakpoint
CREATE POLICY "Enable insert for users based on userId" ON "Score" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((( SELECT auth.uid()) = "userId"));--> statement-breakpoint
CREATE POLICY "Enable users to view their own data only" ON "Score" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((auth.uid() = "userId"));--> statement-breakpoint
CREATE POLICY "Enable insert for authenticated users only" ON "TeeInfo" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "Enable read access for all users" ON "TeeInfo" AS PERMISSIVE FOR SELECT TO "authenticated";