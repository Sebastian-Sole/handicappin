/**
 * Round validation schemas for handicap recalculation (Node.js/Vercel).
 *
 * These schemas validate database query results for the handicap recalculation
 * cron job. They are NOT synced with the main app input schemas.
 *
 * Note: A parallel version exists for Supabase Edge Functions (Deno) at:
 * supabase/functions/handicap-shared/round-schemas.ts
 */
import { z } from "zod";

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
