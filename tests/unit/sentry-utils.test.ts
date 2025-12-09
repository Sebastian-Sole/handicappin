import { describe, test, expect, vi, beforeEach } from "vitest";
import { captureSentryError } from "@/lib/sentry-utils";
import * as Sentry from "@sentry/nextjs";

// Mock Sentry
vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

describe("Sentry Error Capture with PII Redaction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("should capture error with redacted context", () => {
    const error = new Error("Test error");
    const mockCaptureException = vi.mocked(Sentry.captureException);

    captureSentryError(error, {
      userId: "550e8400-e29b-41d4-a716-446655440000",
      email: "test@example.com",
      customerId: "cus_ABC123DEF456",
      sessionId: "cs_test_1234567890ABCDEF",
      subscriptionId: "sub_1234567890ABCDEF",
    });

    expect(mockCaptureException).toHaveBeenCalledTimes(1);
    const [capturedError, options] = mockCaptureException.mock.calls[0];

    // Error should be sanitized (not the same instance as original)
    expect((capturedError as Error).message).toBe("Test error");
    expect((capturedError as Error).name).toBe("Error");

    // User ID logged directly (pseudonymous, fine for Sentry)
    expect(options?.user?.id).toBe("550e8400-e29b-41d4-a716-446655440000");
    expect(options?.contexts?.user_context?.user_id).toBe("550e8400-e29b-41d4-a716-446655440000");

    // Email redacted
    expect(options?.contexts?.user_context?.email).toBe("***@example.com");

    // Stripe IDs partially redacted
    expect(options?.contexts?.stripe?.customer_id).toBe("cus_ABC...");
    expect(options?.contexts?.stripe?.session_id).toBe("cs_test_123...");
    expect(options?.contexts?.stripe?.subscription_id).toBe("sub_123...");
  });

  test("should handle minimal context", () => {
    const error = new Error("Minimal error");
    const mockCaptureException = vi.mocked(Sentry.captureException);

    captureSentryError(error, {});

    expect(mockCaptureException).toHaveBeenCalledTimes(1);
    const [, options] = mockCaptureException.mock.calls[0];

    expect(options?.level).toBe("error"); // Default level
    expect(options?.user).toBeUndefined(); // No user context
    expect(options?.contexts?.user_context?.user_id).toBe("N/A");
    expect(options?.contexts?.stripe?.customer_id).toBe("N/A");
  });

  test("should set custom error level", () => {
    const error = new Error("Warning error");
    const mockCaptureException = vi.mocked(Sentry.captureException);

    captureSentryError(error, {
      level: "warning",
    });

    expect(mockCaptureException).toHaveBeenCalledTimes(1);
    const [, options] = mockCaptureException.mock.calls[0];

    expect(options?.level).toBe("warning");
  });

  test("should include custom tags", () => {
    const error = new Error("Tagged error");
    const mockCaptureException = vi.mocked(Sentry.captureException);

    captureSentryError(error, {
      eventType: "payment_failed",
      tags: {
        payment_method: "stripe",
        environment: "production",
      },
    });

    expect(mockCaptureException).toHaveBeenCalledTimes(1);
    const [, options] = mockCaptureException.mock.calls[0];

    expect(options?.tags?.event_type).toBe("payment_failed");
    expect(options?.tags?.payment_method).toBe("stripe");
    expect(options?.tags?.environment).toBe("production");
  });

  test("should include extra context", () => {
    const error = new Error("Error with context");
    const mockCaptureException = vi.mocked(Sentry.captureException);

    captureSentryError(error, {
      extra: {
        metadata: { key: "value" },
        debug_info: "useful data",
      },
    });

    expect(mockCaptureException).toHaveBeenCalledTimes(1);
    const [, options] = mockCaptureException.mock.calls[0];

    // Extra context now includes original_error_message for debugging
    expect(options?.extra).toEqual({
      metadata: { key: "value" },
      debug_info: "useful data",
      original_error_message: "Error with context",
    });
  });

  test("should create fingerprint for error grouping", () => {
    const error = new Error("Grouped error");
    error.stack = `Error: Grouped error
    at testFunction (file.ts:10:5)
    at anotherFunction (file.ts:20:10)`;

    const mockCaptureException = vi.mocked(Sentry.captureException);

    captureSentryError(error, {
      eventType: "database_error",
    });

    expect(mockCaptureException).toHaveBeenCalledTimes(1);
    const [, options] = mockCaptureException.mock.calls[0];

    expect(options?.fingerprint).toEqual([
      "Error",
      "database_error",
      "at testFunction (file.ts:10:5)",
    ]);
  });

  test("should handle error without stack trace", () => {
    const error = new Error("No stack");
    delete error.stack;

    const mockCaptureException = vi.mocked(Sentry.captureException);

    captureSentryError(error, {
      eventType: "unknown_error",
    });

    expect(mockCaptureException).toHaveBeenCalledTimes(1);
    const [, options] = mockCaptureException.mock.calls[0];

    expect(options?.fingerprint).toEqual([
      "Error",
      "unknown_error",
      "unknown-location",
    ]);
  });

  test("should include event_id and timestamp", () => {
    const error = new Error("Event tracking");
    const mockCaptureException = vi.mocked(Sentry.captureException);

    captureSentryError(error, {
      eventId: "evt_123456",
    });

    expect(mockCaptureException).toHaveBeenCalledTimes(1);
    const [, options] = mockCaptureException.mock.calls[0];

    expect(options?.contexts?.event?.event_id).toBe("evt_123456");
    expect(options?.contexts?.event?.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  test("should sanitize customer IDs in error messages", () => {
    const error = new Error("Customer cus_ABC123DEF456 not found");
    const mockCaptureException = vi.mocked(Sentry.captureException);

    captureSentryError(error, {});

    expect(mockCaptureException).toHaveBeenCalledTimes(1);
    const [capturedError] = mockCaptureException.mock.calls[0];

    // Error message should have customer ID redacted
    expect((capturedError as Error).message).toBe("Customer cus_ABC... not found");
    expect((capturedError as Error).message).not.toContain("cus_ABC123DEF456");
  });

  test("should sanitize session IDs in error messages", () => {
    const error = new Error("Missing subscription ID in checkout session cs_test_a1075F4LOhybFEJSaUYjhJxC3NSwg3GF9iLMl7dqfo07MCyx3timUKeo8V");
    const mockCaptureException = vi.mocked(Sentry.captureException);

    captureSentryError(error, {});

    expect(mockCaptureException).toHaveBeenCalledTimes(1);
    const [capturedError] = mockCaptureException.mock.calls[0];

    // Error message should have session ID redacted
    expect((capturedError as Error).message).toBe("Missing subscription ID in checkout session cs_test_a10...");
  });

  test("should sanitize subscription IDs in error messages", () => {
    const error = new Error("No price ID in subscription sub_1234567890ABCDEF for user 550e8400-e29b-41d4-a716-446655440000");
    const mockCaptureException = vi.mocked(Sentry.captureException);

    captureSentryError(error, {});

    expect(mockCaptureException).toHaveBeenCalledTimes(1);
    const [capturedError] = mockCaptureException.mock.calls[0];

    // Subscription ID redacted, UUID kept (it's pseudonymous)
    expect((capturedError as Error).message).toBe("No price ID in subscription sub_123... for user 550e8400-e29b-41d4-a716-446655440000");
  });

  test("should sanitize multiple IDs in error messages", () => {
    const error = new Error("User already has customer cus_OLD123 but trying to create cus_NEW456");
    const mockCaptureException = vi.mocked(Sentry.captureException);

    captureSentryError(error, {});

    expect(mockCaptureException).toHaveBeenCalledTimes(1);
    const [capturedError] = mockCaptureException.mock.calls[0];

    // Both customer IDs should be redacted
    expect((capturedError as Error).message).toBe("User already has customer cus_OLD... but trying to create cus_NEW...");
  });

  test("should sanitize payment intent and invoice IDs", () => {
    const error = new Error("Payment intent pi_ABC123 failed for invoice in_DEF456");
    const mockCaptureException = vi.mocked(Sentry.captureException);

    captureSentryError(error, {});

    expect(mockCaptureException).toHaveBeenCalledTimes(1);
    const [capturedError] = mockCaptureException.mock.calls[0];

    expect((capturedError as Error).message).toBe("Payment intent pi_ABC... failed for invoice in_DEF...");
  });

  test("should preserve error stack trace after sanitization", () => {
    const error = new Error("Customer cus_ABC123 not found");
    error.stack = "Error: Customer cus_ABC123 not found\n    at handleCustomer (webhook.ts:123:5)";
    const mockCaptureException = vi.mocked(Sentry.captureException);

    captureSentryError(error, {});

    expect(mockCaptureException).toHaveBeenCalledTimes(1);
    const [capturedError] = mockCaptureException.mock.calls[0];

    // Stack trace should be preserved
    expect((capturedError as Error).stack).toBe("Error: Customer cus_ABC123 not found\n    at handleCustomer (webhook.ts:123:5)");
  });
});
