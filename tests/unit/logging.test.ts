import { describe, test, expect } from "vitest";
import {
  redactEmail,
  redactCustomerId,
  redactSessionId,
  redactSubscriptionId,
  redactObject,
} from "@/lib/logging";

describe("PII Redaction - Industry Standard Approach", () => {
  describe("redactEmail", () => {
    test("should redact email local part, keep domain", () => {
      const email = "john.doe@example.com";
      const redacted = redactEmail(email);

      expect(redacted).toBe("***@example.com");
      expect(redacted).not.toContain("john.doe");
    });

    test("should handle different domains", () => {
      expect(redactEmail("user@gmail.com")).toBe("***@gmail.com");
      expect(redactEmail("admin@company.org")).toBe("***@company.org");
    });

    test("should handle invalid emails", () => {
      expect(redactEmail("invalid")).toBe("***@invalid");
      expect(redactEmail(null)).toBe("***@unknown");
      expect(redactEmail(undefined)).toBe("***@unknown");
    });
  });

  describe("redactCustomerId", () => {
    test("should partially redact Stripe customer ID", () => {
      const customerId = "cus_ABC123DEF456";
      const redacted = redactCustomerId(customerId);

      expect(redacted).toBe("cus_ABC...");
      expect(redacted).toContain("cus_");
    });

    test("should handle short customer IDs", () => {
      const customerId = "cus_AB";
      const redacted = redactCustomerId(customerId);

      expect(redacted).toBe("cus_AB"); // Too short to redact
    });

    test("should handle null/undefined", () => {
      expect(redactCustomerId(null)).toBe("cus_unknown");
      expect(redactCustomerId(undefined)).toBe("cus_unknown");
    });

    test("should handle customer ID without prefix", () => {
      const customerId = "123456789";
      const redacted = redactCustomerId(customerId);

      expect(redacted).toBe("cus_123...");
    });
  });

  describe("redactSessionId", () => {
    test("should partially redact Stripe session ID", () => {
      const sessionId = "cs_test_a1075F4LOhybFEJSaUYjhJxC3NSwg3GF9iLMl7dqfo07MCyx3timUKeo8V";
      const redacted = redactSessionId(sessionId);

      expect(redacted).toBe("cs_test_a10...");
      expect(redacted).toContain("cs_test_");
    });

    test("should handle short session IDs", () => {
      const sessionId = "cs_test_abc";
      const redacted = redactSessionId(sessionId);

      expect(redacted).toBe("cs_test_abc"); // Too short to redact
    });

    test("should handle null/undefined", () => {
      expect(redactSessionId(null)).toBe("session_unknown");
      expect(redactSessionId(undefined)).toBe("session_unknown");
    });
  });

  describe("redactSubscriptionId", () => {
    test("should partially redact Stripe subscription ID", () => {
      const subscriptionId = "sub_1234567890ABCDEF";
      const redacted = redactSubscriptionId(subscriptionId);

      expect(redacted).toBe("sub_123...");
      expect(redacted).toContain("sub_");
    });

    test("should handle null/undefined", () => {
      expect(redactSubscriptionId(null)).toBe("sub_unknown");
      expect(redactSubscriptionId(undefined)).toBe("sub_unknown");
    });
  });

  describe("redactObject - Recursive Redaction", () => {
    test("should redact emails in nested objects", () => {
      const obj = {
        user: {
          email: "test@example.com",
        },
      };

      const redacted = redactObject(obj);

      expect(redacted.user.email).toBe("***@example.com");
    });

    test("should NOT redact UUIDs (they're pseudonymous)", () => {
      const obj = {
        userId: "550e8400-e29b-41d4-a716-446655440000",
        id: "550e8400-e29b-41d4-a716-446655440000",
      };

      const redacted = redactObject(obj);

      // UUIDs are kept as-is for debugging
      expect(redacted.userId).toBe("550e8400-e29b-41d4-a716-446655440000");
      expect(redacted.id).toBe("550e8400-e29b-41d4-a716-446655440000");
    });

    test("should redact Stripe IDs in nested objects", () => {
      const obj = {
        stripe: {
          customerId: "cus_ABC123DEF456",
          sessionId: "cs_test_1234567890ABCDEF",
          subscriptionId: "sub_1234567890ABCDEF",
        },
      };

      const redacted = redactObject(obj);

      expect(redacted.stripe.customerId).toBe("cus_ABC...");
      expect(redacted.stripe.sessionId).toBe("cs_test_123...");
      expect(redacted.stripe.subscriptionId).toBe("sub_123...");
    });

    test("should handle arrays of objects", () => {
      const obj = {
        issues: [
          { email: "user1@example.com" },
          { email: "user2@gmail.com" },
        ],
      };

      const redacted = redactObject(obj);

      expect(redacted.issues[0].email).toBe("***@example.com");
      expect(redacted.issues[1].email).toBe("***@gmail.com");
    });

    test("should handle deeply nested structures", () => {
      const obj = {
        level1: {
          level2: {
            level3: {
              email: "deep@example.com",
            },
          },
        },
      };

      const redacted = redactObject(obj);

      expect(redacted.level1.level2.level3.email).toBe("***@example.com");
    });

    test("should handle null/undefined", () => {
      expect(redactObject(null as any)).toBe(null);
      expect(redactObject(undefined as any)).toBe(undefined);
    });

    test("should not mutate original object", () => {
      const obj = {
        email: "test@example.com",
        name: "Test User",
      };

      const originalEmail = obj.email;
      const redacted = redactObject(obj);

      // Original should be unchanged
      expect(obj.email).toBe(originalEmail);
      // Redacted should be different
      expect(redacted.email).toBe("***@example.com");
    });

    test("should handle mixed types in arrays", () => {
      const obj = {
        data: [
          { email: "user@example.com" },
          "string value",
          123,
          null,
        ],
      };

      const redacted = redactObject(obj);

      expect((redacted.data[0] as { email: string }).email).toBe("***@example.com");
      expect(redacted.data[1]).toBe("string value");
      expect(redacted.data[2]).toBe(123);
      expect(redacted.data[3]).toBe(null);
    });
  });
});
