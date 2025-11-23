import { NextRequest, NextResponse } from "next/server";
import { ZodSchema, ZodError } from "zod";
import { ErrorResponseSchema } from "./stripe-types";

/**
 * Validate request body against a Zod schema
 * Returns parsed data or null (with error response)
 */
export async function validateRequest<T>(
  request: NextRequest,
  schema: ZodSchema<T>
): Promise<{ data: T } | { error: NextResponse }> {
  try {
    const body = await request.json();
    const parsed = schema.parse(body);
    return { data: parsed };
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        error: NextResponse.json(
          {
            error: "Invalid request body",
            details: error.issues.map((e) => `${e.path.join(".")}: ${e.message}`).join(", "),
          },
          { status: 400 }
        ),
      };
    }

    return {
      error: NextResponse.json(
        { error: "Failed to parse request body" },
        { status: 400 }
      ),
    };
  }
}

/**
 * Create a type-safe success response
 */
export function successResponse<T>(data: T, headers?: Record<string, string>) {
  return NextResponse.json(data, { headers });
}

/**
 * Create a type-safe error response
 */
export function errorResponse(
  error: string,
  status: number = 500,
  details?: { retryAfter?: number; details?: string }
) {
  const response = ErrorResponseSchema.parse({
    error,
    ...details,
  });

  return NextResponse.json(response, { status });
}
