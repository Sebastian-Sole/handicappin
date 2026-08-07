/**
 * Response schemas for the `stats.*` tRPC procedures.
 *
 * Lives here (rather than inline in the screen) so the wire contract is
 * unit-testable without pulling in react-native / expo-router — see
 * apps/native/tests/unit/course-detail-schema.test.ts.
 */
import { z } from "zod";

export const courseDetailRoundSchema = z
  .object({
    id: z.coerce.number(),
    teeTime: z
      .union([z.string(), z.date()])
      .transform((v) => (typeof v === "string" ? v : v.toISOString())),
    totalStrokes: z.coerce.number(),
    parPlayed: z.coerce.number(),
    scoreDifferential: z.coerce.number(),
    holesPlayed: z.coerce.number(),
    nineHoleSection: z.enum(["front", "back"]).nullable(),
    teeName: z.string(),
    // Accept-and-quarantine (decision D4). Declared explicitly rather than
    // left to `.passthrough()` — passthrough keeps the value at runtime but
    // types it `unknown`, which can't drive the badge. Required, so a server
    // that stopped sending it fails loudly here instead of silently
    // rendering a non-counting round as if it counts.
    quarantined: z.boolean(),
  })
  .passthrough();

export const courseDetailSchema = z
  .object({
    course: z.object({
      id: z.coerce.number(),
      name: z.string(),
      city: z.string(),
      country: z.string(),
    }),
    summary: z.object({
      // Counted (non-quarantined) rounds only — nullable aggregates cover a
      // course whose every round is quarantined.
      roundCount: z.coerce.number(),
      avgScore: z.coerce.number().nullable(),
      avgDifferential: z.coerce.number().nullable(),
      bestDifferential: z.coerce.number().nullable(),
      worstDifferential: z.coerce.number().nullable(),
    }),
    /** EVERY round at the course — quarantined ones included (D4). */
    rounds: z.array(courseDetailRoundSchema),
    holes: z.array(
      z
        .object({
          holeNumber: z.coerce.number(),
          par: z.coerce.number(),
          playCount: z.coerce.number(),
          avgStrokes: z.coerce.number(),
          avgVsPar: z.coerce.number(),
          best: z.coerce.number(),
          worst: z.coerce.number(),
        })
        .passthrough(),
    ),
  })
  .nullable();

export type CourseDetail = NonNullable<z.infer<typeof courseDetailSchema>>;
export type CourseDetailRound = CourseDetail["rounds"][number];
