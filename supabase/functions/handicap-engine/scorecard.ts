import { z } from "https://esm.sh/zod@3.24.1";

export const holeSchema = z.object({
  id: z.number().or(z.undefined()),
  teeId: z.number().or(z.undefined()),
  holeNumber: z.number().min(1).max(18),
  par: z.number().min(1).max(5),
  hcp: z.number().min(1).max(18),
  distance: z.number().min(1).max(700),
});

export const teeSchema = z.object({
  id: z.number().or(z.undefined()),
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
  courseId: z.number().or(z.undefined()),
});

export const courseSchema = z.object({
  id: z.number().or(z.undefined()),
  name: z.string(),
  approvalStatus: z.literal("pending").or(z.literal("approved")),
  tees: z
    .array(teeSchema)
    .min(1, "At least one tee required")
    .or(z.undefined()),
});

export const scoreSchema = z.object({
  id: z.number().or(z.undefined()),
  roundId: z.number().or(z.undefined()),
  holeId: z.number().or(z.undefined()),
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
