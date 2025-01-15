-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TABLE "Profile" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"handicapIndex" double precision NOT NULL,
	"verified" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "Profile" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "Hole" (
	"id" serial PRIMARY KEY NOT NULL,
	"hcp" integer NOT NULL,
	"strokes" integer NOT NULL,
	"roundId" integer NOT NULL,
	"holeNumber" integer NOT NULL,
	"par" integer NOT NULL,
	"userId" uuid NOT NULL,
	"hcpStrokes" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "Hole" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "_prisma_migrations" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"checksum" varchar(64) NOT NULL,
	"finished_at" timestamp with time zone,
	"migration_name" varchar(255) NOT NULL,
	"logs" text,
	"rolled_back_at" timestamp with time zone,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"applied_steps_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "Round" (
	"id" serial PRIMARY KEY NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"courseId" integer NOT NULL,
	"teeTime" timestamp(3) NOT NULL,
	"userId" uuid NOT NULL,
	"adjustedGrossScore" integer NOT NULL,
	"existingHandicapIndex" double precision NOT NULL,
	"scoreDifferential" double precision NOT NULL,
	"totalStrokes" integer NOT NULL,
	"notes" text,
	"parPlayed" integer NOT NULL,
	"updatedHandicapIndex" double precision DEFAULT 0 NOT NULL,
	"exceptionalScoreAdjustment" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "Round" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "Course" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"courseRating" double precision NOT NULL,
	"slopeRating" double precision NOT NULL,
	"eighteenHolePar" integer NOT NULL,
	"nineHolePar" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "Course" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Hole" ADD CONSTRAINT "Hole_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "public"."Round"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Hole" ADD CONSTRAINT "Hole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."Profile"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Round" ADD CONSTRAINT "Round_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "public"."Course"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Round" ADD CONSTRAINT "Round_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."Profile"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "Profile_email_key" ON "Profile" USING btree ("email" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "Course_name_key" ON "Course" USING btree ("name" text_ops);--> statement-breakpoint
CREATE POLICY "Allow profile updates for authed users" ON "Profile" AS PERMISSIVE FOR UPDATE TO public USING ((auth.uid() = id));--> statement-breakpoint
CREATE POLICY "Enable delete for users based on user_id" ON "Profile" AS PERMISSIVE FOR DELETE TO public;--> statement-breakpoint
CREATE POLICY "Enable insert for authenticated users only" ON "Profile" AS PERMISSIVE FOR INSERT TO "authenticated";--> statement-breakpoint
CREATE POLICY "Enable users to view their own data only" ON "Profile" AS PERMISSIVE FOR SELECT TO "authenticated";--> statement-breakpoint
CREATE POLICY "Enable insert for users based on userId" ON "Hole" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((( SELECT auth.uid() AS uid) = "userId"));--> statement-breakpoint
CREATE POLICY "Enable users to view their own data only" ON "Hole" AS PERMISSIVE FOR SELECT TO "authenticated";--> statement-breakpoint
CREATE POLICY "Enable insert for users based on userId" ON "Round" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((( SELECT auth.uid() AS uid) = "userId"));--> statement-breakpoint
CREATE POLICY "Enable users to view their own data only" ON "Round" AS PERMISSIVE FOR SELECT TO "authenticated";--> statement-breakpoint
CREATE POLICY "Enable insert for authenticated users only" ON "Course" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "Enable read access for all users" ON "Course" AS PERMISSIVE FOR SELECT TO "authenticated";
*/