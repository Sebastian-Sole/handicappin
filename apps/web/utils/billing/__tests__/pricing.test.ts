import { verifyPaymentAmount, formatAmount, PLAN_PRICING } from "../pricing";
import { describe, test, expect, vi } from "vitest";

describe("verifyPaymentAmount", () => {
  describe("Premium plan", () => {
    test("should accept correct premium amount", () => {
      const result = verifyPaymentAmount("premium", "usd", 1900, true);

      expect(result.valid).toBe(true);
      expect(result.expected).toBe(1900);
      expect(result.actual).toBe(1900);
      expect(result.variance).toBe(0);
      expect(result.currency).toBe("usd");
    });

    test("should reject incorrect premium amount", () => {
      const result = verifyPaymentAmount("premium", "usd", 1000, true);

      expect(result.valid).toBe(false);
      expect(result.expected).toBe(1900);
      expect(result.actual).toBe(1000);
      expect(result.variance).toBe(900);
    });

    test("should accept amount within tolerance (+1 cent)", () => {
      const result = verifyPaymentAmount("premium", "usd", 1901, true);

      expect(result.valid).toBe(true);
      expect(result.variance).toBe(1);
    });

    test("should accept amount within tolerance (-1 cent)", () => {
      const result = verifyPaymentAmount("premium", "usd", 1899, true);

      expect(result.valid).toBe(true);
      expect(result.variance).toBe(1);
    });

    test("should reject amount outside tolerance (+2 cents)", () => {
      const result = verifyPaymentAmount("premium", "usd", 1902, true);

      expect(result.valid).toBe(false);
      expect(result.variance).toBe(2);
    });
  });

  describe("Unlimited plan", () => {
    test("should accept correct unlimited amount", () => {
      const result = verifyPaymentAmount("unlimited", "usd", 2900, true);

      expect(result.valid).toBe(true);
      expect(result.expected).toBe(2900);
      expect(result.actual).toBe(2900);
      expect(result.variance).toBe(0);
    });

    test("should reject incorrect unlimited amount", () => {
      const result = verifyPaymentAmount("unlimited", "usd", 1900, true);

      expect(result.valid).toBe(false);
      expect(result.expected).toBe(2900);
      expect(result.actual).toBe(1900);
      expect(result.variance).toBe(1000);
    });
  });

  describe("Lifetime plan", () => {
    test("should accept correct lifetime amount", () => {
      const result = verifyPaymentAmount("lifetime", "usd", 14900, false);

      expect(result.valid).toBe(true);
      expect(result.expected).toBe(14900);
      expect(result.actual).toBe(14900);
      expect(result.variance).toBe(0);
    });

    test("should reject incorrect lifetime amount", () => {
      const result = verifyPaymentAmount("lifetime", "usd", 9999, false);

      expect(result.valid).toBe(false);
      expect(result.expected).toBe(14900);
      expect(result.actual).toBe(9999);
      expect(result.variance).toBe(4901);
    });
  });

  describe("Currency handling", () => {
    test("should handle uppercase currency", () => {
      const result = verifyPaymentAmount("premium", "USD", 1900, true);

      expect(result.valid).toBe(true);
      expect(result.currency).toBe("usd");
    });
  });
});

describe("formatAmount", () => {
  test("should format USD amount correctly", () => {
    expect(formatAmount(1900, "usd")).toBe("$19.00");
    expect(formatAmount(2900, "usd")).toBe("$29.00");
    expect(formatAmount(14900, "usd")).toBe("$149.00");
  });

  test("should format cents correctly", () => {
    expect(formatAmount(1999, "usd")).toBe("$19.99");
    expect(formatAmount(100, "usd")).toBe("$1.00");
    expect(formatAmount(50, "usd")).toBe("$0.50");
  });

  test("should handle zero amount", () => {
    expect(formatAmount(0, "usd")).toBe("$0.00");
  });
});

describe("PLAN_PRICING constants", () => {
  test("should have correct premium pricing", () => {
    expect(PLAN_PRICING.premium.yearly.usd).toBe(1900);
  });

  test("should have correct unlimited pricing", () => {
    expect(PLAN_PRICING.unlimited.yearly.usd).toBe(2900);
  });

  test("should have correct lifetime pricing", () => {
    expect(PLAN_PRICING.lifetime.oneTime.usd).toBe(14900);
  });
});
