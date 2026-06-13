/**
 * Trust-boundary schemas for round/course/tee rows as the tRPC procedures
 * return them (PostgREST `select *` rows — see apps/web/types/supabase.ts).
 * Lenient on ranges (validation happened at write time); strict on shape.
 */
import { z } from "zod";

export const roundRowSchema = z.object({
  id: z.number(),
  userId: z.string(),
  courseId: z.number(),
  teeId: z.number(),
  teeTime: z.string(),
  totalStrokes: z.number(),
  parPlayed: z.number(),
  adjustedGrossScore: z.number(),
  adjustedPlayedScore: z.number(),
  courseHandicap: z.number(),
  scoreDifferential: z.number(),
  existingHandicapIndex: z.number(),
  updatedHandicapIndex: z.number(),
  exceptionalScoreAdjustment: z.number(),
  approvalStatus: z.string(),
  notes: z.string().nullable(),
  createdAt: z.string(),
  course_rating_used: z.number(),
  slope_rating_used: z.number(),
  holes_played: z.number(),
  nine_hole_section: z.string().nullable(),
});

export type RoundRow = z.infer<typeof roundRowSchema>;

export const roundsResponseSchema = z.array(roundRowSchema);

export const courseRowSchema = z.object({
  id: z.number(),
  name: z.string(),
  city: z.string(),
  country: z.string(),
  approvalStatus: z.string(),
  website: z.string().nullable(),
  submittedBy: z.string().nullable(),
});

export type CourseRow = z.infer<typeof courseRowSchema>;

export const teeInfoRowSchema = z.object({
  id: z.number(),
  courseId: z.number(),
  name: z.string(),
  gender: z.string(),
  courseRating18: z.number(),
  slopeRating18: z.number(),
  courseRatingFront9: z.number(),
  slopeRatingFront9: z.number(),
  courseRatingBack9: z.number(),
  slopeRatingBack9: z.number(),
  outPar: z.number(),
  inPar: z.number(),
  totalPar: z.number(),
  outDistance: z.number(),
  inDistance: z.number(),
  totalDistance: z.number(),
  distanceMeasurement: z.string(),
  approvalStatus: z.string(),
  isArchived: z.boolean(),
  parentTeeId: z.number().nullable(),
  submittedBy: z.string().nullable(),
  version: z.number(),
});

export type TeeInfoRow = z.infer<typeof teeInfoRowSchema>;
