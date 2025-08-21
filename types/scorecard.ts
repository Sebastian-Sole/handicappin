import z from "zod";
import { Tables } from "./supabase";

export const holeSchema = z.object({
  id: z.number().or(z.undefined()),
  teeId: z.number().or(z.undefined()),
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

// Enhanced validation for tee creation - requires meaningful values
export const teeCreationSchema = teeSchema
  .extend({
    name: z.string().min(1, "Tee name is required"),
    courseRating18: z
      .number()
      .min(
        40,
        "Course rating must be at least 40. Contact us if you need to add a course out of this range."
      )
      .max(
        90,
        "Course rating must be at most 90. Contact us if you need to add a course out of this range."
      ),
    slopeRating18: z
      .number()
      .min(
        45,
        "Slope rating must be at least 45. Contact us if you need to add a course out of this range."
      )
      .max(
        165,
        "Slope rating must be at most 165. Contact us if you need to add a course out of this range."
      ),

    courseRatingFront9: z
      .number()
      .min(
        20,
        "Front 9 rating must be at least 20. Contact us if you need to add a course out of this range."
      )
      .max(
        45,
        "Front 9 rating must be at most 45. Contact us if you need to add a course out of this range."
      ),
    slopeRatingFront9: z
      .number()
      .min(
        45,
        "Front 9 slope must be at least 45. Contact us if you need to add a course out of this range."
      )
      .max(
        165,
        "Front 9 slope must be at most 165. Contact us if you need to add a course out of this range."
      ),

    courseRatingBack9: z
      .number()
      .min(
        20,
        "Back 9 rating must be at least 20. Contact us if you need to add a course out of this range."
      )
      .max(
        45,
        "Back 9 rating must be at most 45. Contact us if you need to add a course out of this range."
      ),
    slopeRatingBack9: z
      .number()
      .min(
        45,
        "Back 9 slope must be at least 45. Contact us if you need to add a course out of this range."
      )
      .max(
        165,
        "Back 9 slope must be at most 165. Contact us if you need to add a course out of this range."
      ),

    totalPar: z
      .number()
      .min(
        54,
        "Total par must be at least 54. Contact us if you need to add a course out of this range."
      )
      .max(
        80,
        "Total par must be at most 80. Contact us if you need to add a course out of this range."
      ), // practical cap

    outPar: z
      .number()
      .min(
        27,
        "Front 9 par must be at least 27. Contact us if you need to add a course out of this range."
      )
      .max(
        40,
        "Front 9 par must be at most 40. Contact us if you need to add a course out of this range."
      ), // practical cap
    inPar: z
      .number()
      .min(
        27,
        "Back 9 par must be at least 27. Contact us if you need to add a course out of this range."
      )
      .max(
        40,
        "Back 9 par must be at most 40. Contact us if you need to add a course out of this range."
      ), // practical cap

    totalDistance: z
      .number()
      .min(
        1500,
        "Total distance must be at least 1500 yards. Contact us if you need to add a course out of this range."
      )
      .max(
        8700,
        "Total distance must be at most 8700 yards. Contact us if you need to add a course out of this range."
      ),
    outDistance: z
      .number()
      .min(
        750,
        "Front 9 distance must be at least 750 yards. Contact us if you need to add a course out of this range."
      )
      .max(
        4500,
        "Front 9 distance must be at most 4500 yards. Contact us if you need to add a course out of this range."
      ),
    inDistance: z
      .number()
      .min(
        750,
        "Back 9 distance must be at least 750 yards. Contact us if you need to add a course out of this range."
      )
      .max(
        4500,
        "Back 9 distance must be at most 4500 yards. Contact us if you need to add a course out of this range."
      ),
    holes: z.array(holeSchema).min(18, "All 18 holes must be defined"),
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
  id: z.number().or(z.undefined()),
  name: z.string(),
  approvalStatus: z.literal("pending").or(z.literal("approved")),
  country: z.string(),
  website: z.string().optional(),
  city: z.string(),
  tees: z
    .array(teeSchema)
    .min(1, "At least one tee required")
    .or(z.undefined()),
});

// Enhanced validation for course creation - requires meaningful values
export const courseCreationSchema = courseSchema.extend({
  name: z
    .string()
    .min(
      3,
      "Course name must be at least 3 characters. Contact us if you need to add a course out of this range."
    )
    .max(
      100,
      "Course name must be less than 100 characters. Contact us if you need to add a course out of this range."
    ),
  country: z.string(),
  website: z.string().optional(),
  city: z.string().optional(),
  tees: z.array(teeCreationSchema).min(1, "At least one tee required"),
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
export type TeeCreation = z.infer<typeof teeCreationSchema>;
export type CourseCreation = z.infer<typeof courseCreationSchema>;

export type ScorecardWithRound = Scorecard & { round: Tables<"round"> };
