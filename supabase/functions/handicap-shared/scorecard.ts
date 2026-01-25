import { z } from "https://esm.sh/zod@3.24.1";

// Base schemas that handle both fetched data (positive IDs) and user-created data (ID: -1)
export const holeSchema = z.object({
  id: z.number().optional(),
  teeId: z.number().optional(),
  holeNumber: z.number().min(1).max(18),
  par: z
    .number()
    .min(1, "One of the par values is less than 1")
    .max(5, "One of the par values is greater than 5"),
  hcp: z
    .number()
    .min(1, "One of the HCP values is less than 1")
    .max(18, "One of the HCP values is greater than 18"),
  distance: z
    .number()
    .min(1, "One of the distance values is less than 1")
    .max(700, "One of the distance values is greater than 700"),
});

export const teeSchema = z
  .object({
    id: z.number().optional(),
    name: z.string().min(1, "Tee name is required"),
    gender: z.enum(["mens", "ladies"]),
    courseRating18: z
      .number()
      .min(40, "Course rating must be at least 40")
      .max(90, "Course rating must be at most 90"),
    slopeRating18: z
      .number()
      .min(45, "Slope rating must be at least 45")
      .max(165, "Slope rating must be at most 165"),
    courseRatingFront9: z
      .number()
      .min(20, "Front 9 rating must be at least 20")
      .max(45, "Front 9 rating must be at most 45"),
    slopeRatingFront9: z
      .number()
      .min(45, "Front 9 slope must be at least 45")
      .max(165, "Front 9 slope must be at most 165"),
    courseRatingBack9: z
      .number()
      .min(20, "Back 9 rating must be at least 20")
      .max(45, "Back 9 rating must be at most 45"),
    slopeRatingBack9: z
      .number()
      .min(45, "Back 9 slope must be at least 45")
      .max(165, "Back 9 slope must be at most 165"),
    outPar: z
      .number()
      .min(27, "Front 9 par must be at least 27")
      .max(40, "Front 9 par must be at most 40"),
    inPar: z
      .number()
      .min(27, "Back 9 par must be at least 27")
      .max(40, "Back 9 par must be at most 40"),
    totalPar: z
      .number()
      .min(54, "Total par must be at least 54")
      .max(80, "Total par must be at most 80"),
    outDistance: z
      .number()
      .min(750, "Front 9 distance must be at least 750 yards")
      .max(4500, "Front 9 distance must be at most 4500 yards"),
    inDistance: z
      .number()
      .min(750, "Back 9 distance must be at least 750 yards")
      .max(4500, "Back 9 distance must be at most 4500 yards"),
    totalDistance: z
      .number()
      .min(1500, "Total distance must be at least 1500 yards")
      .max(8700, "Total distance must be at most 8700 yards"),
    distanceMeasurement: z.literal("meters").or(z.literal("yards")),
    approvalStatus: z.literal("approved").or(z.literal("pending")),
    holes: z
      .array(holeSchema)
      .min(18, "All 18 holes must be defined")
      .or(z.undefined()),
    courseId: z.number().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.outPar + v.inPar !== v.totalPar) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["totalPar"],
        message: "totalPar must equal outPar + inPar",
      });
    }
    if (v.outDistance + v.inDistance !== v.totalDistance) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["totalDistance"],
        message: "totalDistance must equal outDistance + inDistance",
      });
    }
  });

export const courseSchema = z.object({
  id: z.number().optional(),
  name: z
    .string()
    .min(3, "Course name must be at least 3 characters")
    .max(100, "Course name must be less than 100 characters"),
  approvalStatus: z.literal("pending").or(z.literal("approved")),
  country: z.string(),
  website: z
    .string()
    .transform((val) => {
      if (!val || val === "") return "";
      if (!/^https?:\/\//i.test(val)) return `https://${val}`;
      return val;
    })
    .pipe(z.string().url("Please enter a valid URL").or(z.literal("")))
    .optional(),
  city: z.string(),
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

// Round schemas - only needed in edge functions for handicap calculation
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
