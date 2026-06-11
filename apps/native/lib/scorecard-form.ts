/**
 * Add-course / add-tee FORM schemas — mirror of the refinement layer in
 * apps/web/types/scorecard-input.ts on top of the shared core schemas
 * (out+in must equal totals, hole HCPs unique, tee name+gender unique).
 * Core field rules come from @handicappin/handicap-core; never duplicated.
 */
import { teeSchema } from "@handicappin/handicap-core";
import type { Tee } from "@handicappin/handicap-core";
import { z } from "zod";

import { courseInputSchema } from "@/lib/scorecard";

export const teeFormSchema = teeSchema.superRefine((v, ctx) => {
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
  if (v.holes && v.holes.length === 18) {
    const nonZero = v.holes.map((hole) => hole.hcp).filter((hcp) => hcp !== 0);
    if (new Set(nonZero).size !== nonZero.length) {
      const seen = new Set<number>();
      const duplicates = new Set<number>();
      for (const hcp of nonZero) {
        if (seen.has(hcp)) duplicates.add(hcp);
        seen.add(hcp);
      }
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["holes"],
        message: `Handicap values must be unique for each hole. Duplicate values: ${Array.from(
          duplicates,
        )
          .sort((a, b) => a - b)
          .join(", ")}`,
      });
    }
  }
});

export const courseFormSchema = courseInputSchema.extend({
  website: z
    .string()
    .transform((val) => {
      if (!val || val === "") return "";
      if (!/^https?:\/\//i.test(val)) return `https://${val}`;
      return val;
    })
    .pipe(z.string().url("Please enter a valid URL").or(z.literal("")))
    .optional(),
  tees: z
    .array(teeFormSchema)
    .min(1, "At least one tee required")
    .refine(
      (tees) => {
        const keys = tees.map((tee) => `${tee.name}_${tee.gender}`);
        return new Set(keys).size === keys.length;
      },
      { message: "Each tee must have a unique name and gender combination" },
    ),
});

export type CourseForm = z.infer<typeof courseFormSchema>;

export function blankTee(): Tee {
  return {
    name: "",
    gender: "mens",
    courseRating18: 0,
    slopeRating18: 0,
    courseRatingFront9: 0,
    slopeRatingFront9: 0,
    courseRatingBack9: 0,
    slopeRatingBack9: 0,
    outPar: 0,
    inPar: 0,
    totalPar: 0,
    outDistance: 0,
    inDistance: 0,
    totalDistance: 0,
    distanceMeasurement: "meters",
    approvalStatus: "pending",
    holes: Array.from({ length: 18 }, (_, index) => ({
      holeNumber: index + 1,
      par: 0,
      hcp: 0,
      distance: 0,
    })),
  };
}

/**
 * Human list of what's still wrong with a tee — web's grouping: per-hole
 * issues collapse to one line per (field, message) so 18 empty holes read
 * as one item, not 54.
 */
export function getTeeValidationErrors(tee: Tee): string[] {
  const result = teeFormSchema.safeParse(tee);
  if (result.success) return [];

  const seenHoleErrors = new Set<string>();
  return result.error.issues
    .filter((err) => {
      if (
        err.path &&
        err.path[0] === "holes" &&
        typeof err.path[2] === "string" &&
        ["par", "hcp", "distance"].includes(err.path[2])
      ) {
        const key = `${err.path[2]}|${err.message}`;
        if (seenHoleErrors.has(key)) return false;
        seenHoleErrors.add(key);
        return true;
      }
      return true;
    })
    .map((err) => err.message);
}

export function isTeeValid(tee: Tee): boolean {
  return teeFormSchema.safeParse(tee).success;
}
