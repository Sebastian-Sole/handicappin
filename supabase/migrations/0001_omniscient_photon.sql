ALTER TABLE "Hole" RENAME COLUMN "length" TO "distance";--> statement-breakpoint
ALTER TABLE "TeeInfo" RENAME COLUMN "courseRating" TO "courseRating18";--> statement-breakpoint
ALTER TABLE "TeeInfo" RENAME COLUMN "slopeRating" TO "slopeRating18";--> statement-breakpoint
ALTER TABLE "TeeInfo" ALTER COLUMN "inPar" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "TeeInfo" ALTER COLUMN "inDistance" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "TeeInfo" ADD COLUMN "numberOfHoles" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "TeeInfo" ADD COLUMN "courseRatingFront9" double precision NOT NULL;--> statement-breakpoint
ALTER TABLE "TeeInfo" ADD COLUMN "slopeRatingFront9" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "TeeInfo" ADD COLUMN "courseRatingBack9" double precision NOT NULL;--> statement-breakpoint
ALTER TABLE "TeeInfo" ADD COLUMN "slopeRatingBack9" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "TeeInfo" DROP COLUMN "distanceMeasurement";--> statement-breakpoint
ALTER TABLE "TeeInfo" DROP COLUMN "handicaps";--> statement-breakpoint
ALTER TABLE "TeeInfo" DROP COLUMN "distances";--> statement-breakpoint
ALTER TABLE "TeeInfo" DROP COLUMN "pars";