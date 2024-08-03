import z from "zod";

export const holeSchema = z.object({
  holeNumber: z.number().min(1).max(18),
  par: z.number().min(1).max(5),
  hcp: z.number().min(1).max(18),
  strokes: z.number().min(1).max(10),
});

export const courseInfoSchema = z.object({
  par: z.number().min(27).max(100),
  courseRating: z.number().min(0).max(100),
  slope: z.number().min(60).max(140),
  location: z.string(),
});

export const addRoundFormSchema = z.object({
  userId: z.string(),
  numberOfHoles: z.number().min(1).max(18),
  courseInfo: courseInfoSchema,
  holes: z.array(holeSchema),
  date: z.date().optional(),
  notes: z.string().optional(),
});

export type Hole = z.infer<typeof holeSchema>;
export type FormRound = z.infer<typeof addRoundFormSchema>;

export const roundMutationSchema = z.object({
  userId: z.string(),
  courseInfo: courseInfoSchema,
  holes: z.array(holeSchema),
  adjustedPlayedScore: z.number().min(9),
  adjustedGrossScore: z.number().min(9),
  scoreDifferential: z.number(),
  totalStrokes: z.number(),
  existingHandicapIndex: z.number(),
  teeTime: z.date(),
  courseRating: z.number().min(1),
  slopeRating: z.number().min(1),
  nineHolePar: z.number().min(27),
  eighteenHolePar: z.number().min(54),
  parPlayed: z.number().min(9),
  exceptionalScoreAdjustment: z.number().default(0),
});

export type RoundMutation = z.infer<typeof roundMutationSchema>;
