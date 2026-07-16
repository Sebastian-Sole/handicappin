/**
 * Scorecard utilities + input schema — mirrors apps/web/utils/scorecard/
 * scorecardUtils.ts and types/scorecard-input.ts. Domain shapes (tee/hole/
 * score) come from @handicappin/handicap-core — never duplicated.
 */
import { holeSchema, teeSchema, scoreSchema } from "@handicappin/handicap-core";
import type { Hole, Tee, Score } from "@handicappin/handicap-core";
import { z } from "zod";

export type { Hole, Tee, Score };

export const FREE_TIER_ROUND_LIMIT = 25;

export const courseInputSchema = z.object({
  id: z.number().optional(),
  name: z
    .string()
    .min(3, "Course name must be at least 3 characters")
    .max(100, "Course name must be less than 100 characters"),
  approvalStatus: z.literal("pending").or(z.literal("approved")),
  country: z.string().min(1, "Country is required"),
  website: z.string().optional(),
  city: z.string().min(1, "City is required"),
  tees: z.array(teeSchema).optional(),
});

export type CourseInput = z.infer<typeof courseInputSchema>;

/**
 * Score with optional shot-level detail (plans/010) — EXTENDS the core
 * domain shape rather than duplicating it. Mirrors the fields added to
 * apps/web/types/scorecard-input.ts scoreSchema; the detail is
 * informational only and never a handicap-engine input.
 */
export const scoreInputSchema = scoreSchema.extend({
  putts: z.number().int().min(0).max(20).nullish(),
  fairwayHit: z.boolean().nullish(),
  penaltyStrokes: z.number().int().min(0).max(10).nullish(),
});

export type ScoreInput = z.infer<typeof scoreInputSchema>;

export const scorecardInputSchema = z.object({
  userId: z.string().uuid(),
  course: courseInputSchema,
  teePlayed: teeSchema,
  scores: z.array(scoreInputSchema),
  teeTime: z.string(),
  approvalStatus: z.literal("pending").or(z.literal("approved")),
  notes: z.string().optional(),
  nineHoleSection: z.enum(["front", "back"]).optional(),
});

export type ScorecardInput = z.infer<typeof scorecardInputSchema>;

/** Re-map hole handicaps 1–9 when only nine holes are played (USGA 5.1b). */
export function normalizeHcpForNineHoles(
  holes: Hole[] | undefined,
  holeCount: number,
  section: "front" | "back" = "front",
): Hole[] {
  if (!holes) return [];
  const sortedHoles = [...holes].sort((a, b) => a.holeNumber - b.holeNumber);
  if (holeCount === 18) return sortedHoles;

  const nineHoles =
    section === "back" ? sortedHoles.slice(9, 18) : sortedHoles.slice(0, 9);
  const uniqueHcps = nineHoles.map((hole) => hole.hcp);
  uniqueHcps.sort((a, b) => a - b);
  const hcpMapping = new Map(uniqueHcps.map((hcp, idx) => [hcp, idx + 1]));

  return nineHoles.map((hole) => ({
    ...hole,
    hcp: hcpMapping.get(hole.hcp) ?? hole.hcp,
  }));
}

export function getDisplayedHoles(
  selectedTee: { holes?: Hole[] } | undefined,
  holeCount: number,
  section: "front" | "back" = "front",
): Hole[] {
  if (!selectedTee?.holes) return [];
  return normalizeHcpForNineHoles(selectedTee.holes, holeCount, section);
}

export function roundToNearestMinute(date: Date): Date {
  const newDate = new Date(date);
  newDate.setSeconds(0);
  newDate.setMilliseconds(0);
  return newDate;
}

/** Validate the schemas stay importable from handicap-core (compile guard). */
export const _coreSchemas = { holeSchema, teeSchema, scoreSchema };
