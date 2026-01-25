/**
 * Handicap-related schemas for API validation.
 * Reuses Drizzle-generated schemas from db/schema.ts.
 */
import { z } from "zod";
import { roundSchema } from "@/db/schema";

// Schema for validating arrays of rounds from database queries
export const roundResponseSchema = z.array(roundSchema);

export type RoundResponse = z.infer<typeof roundResponseSchema>;
