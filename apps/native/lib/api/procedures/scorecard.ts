/**
 * Native facade for the scorecard-entry procedures: course search, tee
 * fetch, and the submitScorecard mutation (the app's real round write path).
 */
import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";

import { trpcMutation, trpcQuery } from "@/lib/api/client";
import { scorecardsResponseSchema } from "@/lib/api/schemas/scorecard";
import type { ScorecardInput } from "@/lib/scorecard";

export const searchedCourseSchema = z.object({
  id: z.number(),
  name: z.string(),
  approvalStatus: z.literal("approved"),
  country: z.string(),
  city: z.string(),
  website: z.string().optional(),
});

export type SearchedCourse = z.infer<typeof searchedCourseSchema>;

export const courseSearchQueryOptions = (query: string) =>
  queryOptions({
    queryKey: ["course.searchCourses", query] as const,
    queryFn: () =>
      trpcQuery(
        "course.searchCourses",
        { query },
        z.array(searchedCourseSchema),
      ),
  });

export const fetchedTeeSchema = z.object({
  id: z.number().optional(),
  courseId: z.number().optional(),
  name: z.string(),
  gender: z.string(),
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
  distanceMeasurement: z.string(),
  approvalStatus: z.string(),
  holes: z
    .array(
      z.object({
        id: z.number().optional(),
        teeId: z.number().optional(),
        holeNumber: z.number(),
        par: z.number(),
        hcp: z.number(),
        distance: z.number(),
      }),
    )
    .optional(),
});

export type FetchedTee = z.infer<typeof fetchedTeeSchema>;

export const courseTeesQueryOptions = (courseId: number) =>
  queryOptions({
    queryKey: ["tee.fetchTees", courseId] as const,
    queryFn: () =>
      trpcQuery("tee.fetchTees", { courseId }, z.array(fetchedTeeSchema)),
  });

/** The result is DISCARDED by every caller — success is signalled by the
    mutation not throwing. No field is consumed, so no response schema is
    enforced; add one the day a caller starts reading the payload. */
const submitResultSchema = z.unknown();

export function submitScorecard(input: ScorecardInput): Promise<unknown> {
  return trpcMutation("round.submitScorecard", input, submitResultSchema);
}

export const scorecardsQueryOptions = (userId: string) =>
  queryOptions({
    queryKey: ["scorecard.getAllScorecardsByUserId", userId] as const,
    queryFn: () =>
      trpcQuery(
        "scorecard.getAllScorecardsByUserId",
        { userId },
        scorecardsResponseSchema,
      ),
  });
