import z from "zod";

export const holeSchema = z.object({
  holeNumber: z.number().min(1).max(18),
  par: z.number().min(1).max(5),
  hcp: z.number().min(1).max(18),
  strokes: z.number().min(1).max(10),
});

export const courseInfoSchema = z.object({
  par: z.number().min(1).max(72),
  courseRating: z.number().min(0).max(100),
  slope: z.number().min(60).max(140),
});

export const roundSchema = z.object({
  userId: z.string(),
  numberOfHoles: z.number().min(1).max(18),
  courseInfo: courseInfoSchema,
  holes: z.array(holeSchema),
  location: z.string(),
  date: z.date(),
  score: z.number().min(0),
  notes: z.string().optional(),
});

export type Hole = z.infer<typeof holeSchema>;
export type Round = z.infer<typeof roundSchema>;
