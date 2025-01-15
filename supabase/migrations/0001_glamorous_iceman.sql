CREATE TABLE "Score" (
	"id" serial PRIMARY KEY NOT NULL,
	"roundId" integer NOT NULL,
	"holeId" integer NOT NULL,
	"strokes" integer NOT NULL,
	"hcpStrokes" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
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
	"isApproved" boolean DEFAULT false NOT NULL,
	"isArchived" boolean DEFAULT false NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "TeeInfo" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "auth"."users" (
	"id" uuid PRIMARY KEY NOT NULL
);
--> statement-breakpoint
ALTER TABLE "_prisma_migrations" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "Hole" DROP CONSTRAINT "Hole_roundId_fkey";
--> statement-breakpoint
ALTER TABLE "Hole" DROP CONSTRAINT "Hole_userId_fkey";
--> statement-breakpoint
ALTER TABLE "Round" ALTER COLUMN "createdAt" SET DATA TYPE timestamp;--> statement-breakpoint
ALTER TABLE "Round" ALTER COLUMN "teeTime" SET DATA TYPE timestamp;--> statement-breakpoint
ALTER TABLE "Hole" ADD COLUMN "teeId" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "Hole" ADD COLUMN "length" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "Round" ADD COLUMN "teeId" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "Course" ADD COLUMN "isApproved" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "Score" ADD CONSTRAINT "Score_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "public"."Round"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Score" ADD CONSTRAINT "Score_holeId_fkey" FOREIGN KEY ("holeId") REFERENCES "public"."Hole"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "TeeInfo" ADD CONSTRAINT "TeeInfo_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "public"."Course"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Hole" ADD CONSTRAINT "Hole_teeId_fkey" FOREIGN KEY ("teeId") REFERENCES "public"."TeeInfo"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Round" ADD CONSTRAINT "Round_teeId_fkey" FOREIGN KEY ("teeId") REFERENCES "public"."TeeInfo"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Hole" DROP COLUMN "strokes";--> statement-breakpoint
ALTER TABLE "Hole" DROP COLUMN "roundId";--> statement-breakpoint
ALTER TABLE "Hole" DROP COLUMN "userId";--> statement-breakpoint
ALTER TABLE "Hole" DROP COLUMN "hcpStrokes";--> statement-breakpoint
ALTER TABLE "Course" DROP COLUMN "courseRating";--> statement-breakpoint
ALTER TABLE "Course" DROP COLUMN "slopeRating";--> statement-breakpoint
ALTER TABLE "Course" DROP COLUMN "eighteenHolePar";--> statement-breakpoint
ALTER TABLE "Course" DROP COLUMN "nineHolePar";--> statement-breakpoint
ALTER POLICY "Enable insert for users based on userId" ON "Hole" RENAME TO "Enable insert for authenticated users only";--> statement-breakpoint
DROP POLICY "Enable users to view their own data only" ON "Hole" CASCADE;--> statement-breakpoint
CREATE POLICY "Enable read access for all users" ON "Hole" AS PERMISSIVE FOR SELECT TO "authenticated";--> statement-breakpoint
CREATE POLICY "Enable insert for authenticated users only" ON "TeeInfo" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "Enable read access for all users" ON "TeeInfo" AS PERMISSIVE FOR SELECT TO "authenticated";