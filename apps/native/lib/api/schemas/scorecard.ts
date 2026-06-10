/**
 * Trust-boundary schema for scorecard.getAllScorecardsByUserId.
 *
 * Unlike the PostgREST-backed procedures, this one reads via DRIZZLE on the
 * server, so superjson revives timestamps as Date objects — every date field
 * accepts string|Date and normalizes to an ISO string. The nested rows keep
 * only the fields native renders (lenient by design; the server validated
 * the rest at write time).
 */
import { z } from "zod";

const dateish = z
  .union([z.string(), z.date()])
  .transform((v) => (typeof v === "string" ? v : v.toISOString()));

export const scorecardRoundSchema = z
  .object({
    id: z.number(),
    courseId: z.number(),
    teeId: z.number(),
    teeTime: dateish,
    totalStrokes: z.number(),
    adjustedGrossScore: z.number(),
    adjustedPlayedScore: z.number(),
    parPlayed: z.number(),
    scoreDifferential: z.number(),
    courseHandicap: z.number(),
    existingHandicapIndex: z.number(),
    updatedHandicapIndex: z.number(),
    exceptionalScoreAdjustment: z.number(),
    approvalStatus: z.string(),
    userId: z.string(),
  })
  .passthrough();

export type ScorecardRound = z.infer<typeof scorecardRoundSchema>;

export const scorecardWithRoundSchema = z
  .object({
    userId: z.string(),
    teeTime: dateish,
    course: z
      .object({
        id: z.number().optional(),
        name: z.string(),
        city: z.string().optional(),
        country: z.string().optional(),
      })
      .passthrough(),
    teePlayed: z
      .object({
        id: z.number().optional(),
        name: z.string(),
        gender: z.string(),
        totalPar: z.number(),
        outPar: z.number(),
        inPar: z.number(),
        courseRating18: z.number(),
        slopeRating18: z.number(),
        totalDistance: z.number(),
        distanceMeasurement: z.string(),
        holes: z.array(z.unknown()).optional(),
      })
      .passthrough(),
    scores: z.array(
      z
        .object({
          strokes: z.number(),
          hcpStrokes: z.number(),
        })
        .passthrough(),
    ),
    round: scorecardRoundSchema,
    roundsBeforeTeeTime: z.number().optional(),
  })
  .passthrough();

export type ScorecardWithRound = z.infer<typeof scorecardWithRoundSchema>;

export const scorecardsResponseSchema = z.array(scorecardWithRoundSchema);
