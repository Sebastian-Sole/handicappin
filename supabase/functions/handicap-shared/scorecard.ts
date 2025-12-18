import { z } from "https://esm.sh/zod@3.24.1";

export const holeSchema = z.object({
  id: z.number().optional(),
  teeId: z.number().optional(),
  holeNumber: z.number().min(1).max(18),
  par: z.number().min(1).max(5),
  hcp: z.number().min(1).max(18),
  distance: z.number().min(1).max(700),
});

export const teeSchema = z.object({
  id: z.number().optional(),
  name: z.string(),
  gender: z.enum(["mens", "ladies"]),
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
  distanceMeasurement: z.literal("meters").or(z.literal("yards")),
  approvalStatus: z.literal("approved").or(z.literal("pending")),
  holes: z.array(holeSchema).or(z.undefined()),
  courseId: z.number().optional(),
});

export const courseSchema = z.object({
  id: z.number().optional(),
  name: z.string(),
  approvalStatus: z.literal("pending").or(z.literal("approved")),
  tees: z
    .array(teeSchema)
    .min(1, "At least one tee required")
    .or(z.undefined()),
});

export const scoreSchema = z.object({
  id: z.number().optional(),
  roundId: z.number().optional(),
  holeId: z.number().optional(),
  strokes: z.number().min(0).max(99),
  hcpStrokes: z.number().min(0).max(99),
});

export const scorecardSchema = z.object({
  userId: z.string().uuid(),
  course: courseSchema,
  teePlayed: teeSchema,
  scores: z.array(scoreSchema),
  teeTime: z.string().datetime(),
  approvalStatus: z.literal("pending").or(z.literal("approved")),
  notes: z.string().optional(),
});

export type Hole = z.infer<typeof holeSchema>;
export type Scorecard = z.infer<typeof scorecardSchema>;
export type Tee = z.infer<typeof teeSchema>;
export type Course = z.infer<typeof courseSchema>;
export type Score = z.infer<typeof scoreSchema>;

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
export const teeResponseSchema = z.array(teeSchema);
export const scoreResponseSchema = z.array(scoreSchema);
export const holeResponseSchema = z.array(holeSchema);

export type Round = z.infer<typeof roundSchema>;
export type RoundResponse = z.infer<typeof roundResponseSchema>;
export type TeeResponse = z.infer<typeof teeResponseSchema>;
export type ScoreResponse = z.infer<typeof scoreResponseSchema>;
export type HoleResponse = z.infer<typeof holeResponseSchema>;
