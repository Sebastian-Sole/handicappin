import { z } from "https://esm.sh/zod";

export const holeSchema = z.object({
  id: z.string().uuid().optional(),
  teeId: z.string().uuid().optional(),
  holeNumber: z.number().min(1).max(18),
  par: z.number().min(1).max(5),
  hcp: z.number().min(1).max(18),
  distance: z.number().min(1).max(700),
});

export const scorecardSchema = z.object({
  userId: z.string().uuid(),
  courseId: z.number().optional(),
  courseName: z.string(),
  teeInfo: z.object({
    name: z.string(),
    gender: z.string(),
    numberOfHoles: z.number().min(9).max(18),
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
  }),
  holes: z.array(holeSchema),
  scores: z.array(z.number().min(1).max(99)),
  teeTime: z.string().datetime(),
});

export type Hole = z.infer<typeof holeSchema>;
export type Scorecard = z.infer<typeof scorecardSchema>;
