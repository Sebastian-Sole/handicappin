ALTER TABLE "tee_info" RENAME TO "teeInfo";--> statement-breakpoint
ALTER TABLE "course" RENAME COLUMN "approval_status" TO "approvalStatus";--> statement-breakpoint
ALTER TABLE "hole" RENAME COLUMN "tee_id" TO "teeId";--> statement-breakpoint
ALTER TABLE "hole" RENAME COLUMN "hole_number" TO "holeNumber";--> statement-breakpoint
ALTER TABLE "profile" RENAME COLUMN "handicap_index" TO "handicapIndex";--> statement-breakpoint
ALTER TABLE "round" RENAME COLUMN "user_id" TO "userId";--> statement-breakpoint
ALTER TABLE "round" RENAME COLUMN "course_id" TO "courseId";--> statement-breakpoint
ALTER TABLE "round" RENAME COLUMN "tee_id" TO "teeId";--> statement-breakpoint
ALTER TABLE "round" RENAME COLUMN "tee_time" TO "teeTime";--> statement-breakpoint
ALTER TABLE "round" RENAME COLUMN "total_strokes" TO "totalStrokes";--> statement-breakpoint
ALTER TABLE "round" RENAME COLUMN "par_played" TO "parPlayed";--> statement-breakpoint
ALTER TABLE "round" RENAME COLUMN "adjusted_gross_score" TO "adjustedGrossScore";--> statement-breakpoint
ALTER TABLE "round" RENAME COLUMN "adjusted_played_score" TO "adjustedPlayedScore";--> statement-breakpoint
ALTER TABLE "round" RENAME COLUMN "course_handicap" TO "courseHandicap";--> statement-breakpoint
ALTER TABLE "round" RENAME COLUMN "score_differential" TO "scoreDifferential";--> statement-breakpoint
ALTER TABLE "round" RENAME COLUMN "existing_handicap_index" TO "existingHandicapIndex";--> statement-breakpoint
ALTER TABLE "round" RENAME COLUMN "updated_handicap_index" TO "updatedHandicapIndex";--> statement-breakpoint
ALTER TABLE "round" RENAME COLUMN "exceptional_score_adjustment" TO "exceptionalScoreAdjustment";--> statement-breakpoint
ALTER TABLE "round" RENAME COLUMN "approval_status" TO "approvalStatus";--> statement-breakpoint
ALTER TABLE "round" RENAME COLUMN "created_at" TO "createdAt";--> statement-breakpoint
ALTER TABLE "score" RENAME COLUMN "user_id" TO "userId";--> statement-breakpoint
ALTER TABLE "score" RENAME COLUMN "round_id" TO "roundId";--> statement-breakpoint
ALTER TABLE "score" RENAME COLUMN "hole_id" TO "holeId";--> statement-breakpoint
ALTER TABLE "score" RENAME COLUMN "hcp_strokes" TO "hcpStrokes";--> statement-breakpoint
ALTER TABLE "teeInfo" RENAME COLUMN "course_id" TO "courseId";--> statement-breakpoint
ALTER TABLE "teeInfo" RENAME COLUMN "course_rating_18" TO "courseRating18";--> statement-breakpoint
ALTER TABLE "teeInfo" RENAME COLUMN "slope_rating_18" TO "slopeRating18";--> statement-breakpoint
ALTER TABLE "teeInfo" RENAME COLUMN "course_rating_front_9" TO "courseRatingFront9";--> statement-breakpoint
ALTER TABLE "teeInfo" RENAME COLUMN "slope_rating_front_9" TO "slopeRatingFront9";--> statement-breakpoint
ALTER TABLE "teeInfo" RENAME COLUMN "course_rating_back_9" TO "courseRatingBack9";--> statement-breakpoint
ALTER TABLE "teeInfo" RENAME COLUMN "slope_rating_back_9" TO "slopeRatingBack9";--> statement-breakpoint
ALTER TABLE "teeInfo" RENAME COLUMN "out_par" TO "outPar";--> statement-breakpoint
ALTER TABLE "teeInfo" RENAME COLUMN "in_par" TO "inPar";--> statement-breakpoint
ALTER TABLE "teeInfo" RENAME COLUMN "total_par" TO "totalPar";--> statement-breakpoint
ALTER TABLE "teeInfo" RENAME COLUMN "out_distance" TO "outDistance";--> statement-breakpoint
ALTER TABLE "teeInfo" RENAME COLUMN "in_distance" TO "inDistance";--> statement-breakpoint
ALTER TABLE "teeInfo" RENAME COLUMN "total_distance" TO "totalDistance";--> statement-breakpoint
ALTER TABLE "teeInfo" RENAME COLUMN "distance_measurement" TO "distanceMeasurement";--> statement-breakpoint
ALTER TABLE "teeInfo" RENAME COLUMN "approval_status" TO "approvalStatus";--> statement-breakpoint
ALTER TABLE "teeInfo" RENAME COLUMN "is_archived" TO "isArchived";--> statement-breakpoint
ALTER TABLE "hole" DROP CONSTRAINT "hole_tee_id_fkey";
--> statement-breakpoint
ALTER TABLE "round" DROP CONSTRAINT "round_course_id_fkey";
--> statement-breakpoint
ALTER TABLE "round" DROP CONSTRAINT "round_user_id_fkey";
--> statement-breakpoint
ALTER TABLE "round" DROP CONSTRAINT "round_tee_id_fkey";
--> statement-breakpoint
ALTER TABLE "score" DROP CONSTRAINT "score_round_id_fkey";
--> statement-breakpoint
ALTER TABLE "score" DROP CONSTRAINT "score_hole_id_fkey";
--> statement-breakpoint
ALTER TABLE "score" DROP CONSTRAINT "score_user_id_fkey";
--> statement-breakpoint
ALTER TABLE "teeInfo" DROP CONSTRAINT "tee_info_course_id_fkey";
--> statement-breakpoint
ALTER TABLE "hole" ADD CONSTRAINT "hole_teeId_fkey" FOREIGN KEY ("teeId") REFERENCES "public"."teeInfo"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "round" ADD CONSTRAINT "round_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "public"."course"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "round" ADD CONSTRAINT "round_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."profile"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "round" ADD CONSTRAINT "round_teeId_fkey" FOREIGN KEY ("teeId") REFERENCES "public"."teeInfo"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "score" ADD CONSTRAINT "score_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "public"."round"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "score" ADD CONSTRAINT "score_holeId_fkey" FOREIGN KEY ("holeId") REFERENCES "public"."hole"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "score" ADD CONSTRAINT "score_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."profile"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "teeInfo" ADD CONSTRAINT "teeInfo_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "public"."course"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER POLICY "Users can view their own rounds" ON "round" TO authenticated USING ((auth.uid()::uuid = userId));--> statement-breakpoint
ALTER POLICY "Users can insert their own rounds" ON "round" TO authenticated WITH CHECK ((auth.uid()::uuid = userId));--> statement-breakpoint
ALTER POLICY "Users can update their own rounds" ON "round" TO authenticated USING ((auth.uid()::uuid = userId));--> statement-breakpoint
ALTER POLICY "Users can delete their own rounds" ON "round" TO authenticated USING ((auth.uid()::uuid = userId));--> statement-breakpoint
ALTER POLICY "Users can view their own scores" ON "score" TO authenticated USING ((auth.uid()::uuid = userId));--> statement-breakpoint
ALTER POLICY "Users can insert their own scores" ON "score" TO authenticated WITH CHECK ((auth.uid()::uuid = userId));--> statement-breakpoint
ALTER POLICY "Users can update their own scores" ON "score" TO authenticated USING ((auth.uid()::uuid = userId));--> statement-breakpoint
ALTER POLICY "Users can delete their own scores" ON "score" TO authenticated USING ((auth.uid()::uuid = userId));