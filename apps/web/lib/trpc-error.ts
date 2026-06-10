/**
 * Type-safe tRPC error utilities for client-side error handling.
 *
 * tRPC errors have a specific shape with data.code and data.cause
 * that TypeScript can't infer from a catch clause. These helpers
 * provide safe access to rate limit info without using `any`.
 */

/**
 * Extract the retryAfter value from a tRPC rate limit error.
 * Returns null if the error is not a rate limit error.
 */
export function getTRPCRateLimitRetryAfter(error: unknown): number | null {
  if (typeof error !== "object" || error === null || !("data" in error)) {
    return null;
  }

  const data = (error as { data?: unknown }).data;
  if (typeof data !== "object" || data === null) {
    return null;
  }

  const { code, cause } = data as { code?: string; cause?: { retryAfter?: number } };
  if (code === "TOO_MANY_REQUESTS" && typeof cause?.retryAfter === "number") {
    return cause.retryAfter;
  }

  return null;
}

/**
 * Extract the error message from a tRPC error or generic Error.
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "object" && error !== null && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return "An unexpected error occurred";
}
