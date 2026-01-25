/**
 * Round validation schemas for handicap recalculation.
 *
 * NOT synced with main app - these schemas validate database query results
 * specifically for the handicap recalculation edge function.
 *
 * Note: This schema intentionally excludes some DB columns (courseRatingUsed,
 * slopeRatingUsed, holesPlayed) because the recalculation fetches fresh tee
 * data rather than using the locked historical values.
 */
import { z } from "https://esm.sh/zod@3.24.1";

export const roundSchema = z.object({
  id: z.number(),
  userId: z.string().uuid(),
  courseId: z.number(),
  teeId: z.number(),
  teeTime: z.string(),
  totalStrokes: z.number(),
  parPlayed: z.number(),
  adjustedGrossScore: z.number(),
  adjustedPlayedScore: z.number(),
  courseHandicap: z.number(),
  scoreDifferential: z.number(),
  existingHandicapIndex: z.number().min(0).max(54),
  updatedHandicapIndex: z.number().min(0).max(54),
  exceptionalScoreAdjustment: z.number().min(0).max(10),
  approvalStatus: z
    .literal("pending")
    .or(z.literal("approved"))
    .or(z.literal("rejected")),
  notes: z.string().nullable().optional(),
  createdAt: z.string(),
});

export const roundResponseSchema = z.array(roundSchema);

export type Round = z.infer<typeof roundSchema>;
export type RoundResponse = z.infer<typeof roundResponseSchema>;
