/**
 * Trust-boundary schemas for the scorecard procedures.
 *
 * Unlike the PostgREST-backed procedures, these read via DRIZZLE on the
 * server: superjson can revive timestamps as Date objects (dates accept
 * string|Date and normalize to ISO strings) and drizzle serializes
 * NUMERIC/DECIMAL columns as strings (numbers are coercive). The nested
 * rows keep only the fields native renders (lenient by design; the server
 * validated the rest at write time).
 */
import { z } from "zod";

const dateish = z
  .union([z.string(), z.date()])
  .transform((v) => (typeof v === "string" ? v : v.toISOString()));

export const scorecardRoundSchema = z
  .object({
    id: z.coerce.number(),
    courseId: z.coerce.number(),
    teeId: z.coerce.number(),
    teeTime: dateish,
    totalStrokes: z.coerce.number(),
    adjustedGrossScore: z.coerce.number(),
    adjustedPlayedScore: z.coerce.number(),
    parPlayed: z.coerce.number(),
    scoreDifferential: z.coerce.number(),
    courseHandicap: z.coerce.number(),
    existingHandicapIndex: z.coerce.number(),
    updatedHandicapIndex: z.coerce.number(),
    exceptionalScoreAdjustment: z.coerce.number(),
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
        id: z.coerce.number().optional(),
        name: z.string(),
        city: z.string().default(""),
        country: z.string().default(""),
      })
      .passthrough(),
    teePlayed: z
      .object({
        id: z.coerce.number().optional(),
        name: z.string(),
        gender: z.string(),
        totalPar: z.coerce.number(),
        outPar: z.coerce.number(),
        inPar: z.coerce.number(),
        courseRating18: z.coerce.number(),
        slopeRating18: z.coerce.number(),
        courseRatingFront9: z.coerce.number(),
        slopeRatingFront9: z.coerce.number(),
        courseRatingBack9: z.coerce.number(),
        slopeRatingBack9: z.coerce.number(),
        totalDistance: z.coerce.number(),
        distanceMeasurement: z.string(),
        holes: z
          .array(
            z
              .object({
                id: z.coerce.number().optional(),
                teeId: z.coerce.number().optional(),
                holeNumber: z.coerce.number(),
                par: z.coerce.number(),
                hcp: z.coerce.number(),
                distance: z.coerce.number(),
              })
              .passthrough(),
          )
          .optional(),
      })
      .passthrough(),
    scores: z.array(
      z
        .object({
          holeId: z.coerce.number().optional(),
          strokes: z.coerce.number(),
          hcpStrokes: z.coerce.number(),
          // Shot-level detail (plans/010). Deliberately NOT z.coerce — the
          // columns are nullable and Number(null) would corrupt NULL → 0.
          putts: z.number().nullish(),
          fairwayHit: z.boolean().nullish(),
          penaltyStrokes: z.number().nullish(),
        })
        .passthrough(),
    ),
    round: scorecardRoundSchema,
    roundsBeforeTeeTime: z.coerce.number().optional(),
  })
  .passthrough();

export type ScorecardWithRound = z.infer<typeof scorecardWithRoundSchema>;

export const scorecardsResponseSchema = z.array(scorecardWithRoundSchema);
