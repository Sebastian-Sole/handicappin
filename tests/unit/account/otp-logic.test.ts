/**
 * OTP Logic Unit Tests
 *
 * Tests for OTP generation, hashing, expiry, and attempt tracking.
 * Account deletion is irreversible - these tests are critical for security.
 */

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import {
  generateOTP,
  hashOTP,
  verifyOTPHash,
  formatOTP,
  getOTPExpiry,
  OTP_LENGTH,
  OTP_EXPIRY_MINUTES,
  OTP_MAX_ATTEMPTS,
} from "@/lib/otp-utils";
import { storeOtp, getOtp, incrementAttempts, deleteOtp } from "@/lib/otp-store";

// Mock the rate-limit module for Redis client
vi.mock("@/lib/rate-limit", () => ({
  getRedisClient: vi.fn(() => null), // Use in-memory fallback
}));

describe("OTP Generation", () => {
  describe("generateOTP", () => {
    test("generates 6-character codes", () => {
      const otp = generateOTP();
      expect(otp).toHaveLength(6);
    });

    test("generates numeric codes only", () => {
      for (let iteration = 0; iteration < 50; iteration++) {
        const otp = generateOTP();
        expect(otp).toMatch(/^\d{6}$/);
      }
    });

    test("pads leading zeros correctly", () => {
      // Run many iterations to increase probability of small numbers
      const otps = new Set<string>();
      for (let iteration = 0; iteration < 100; iteration++) {
        const otp = generateOTP();
        expect(otp.length).toBe(OTP_LENGTH);
        otps.add(otp);
      }
      // Should generate many unique values
      expect(otps.size).toBeGreaterThan(80);
    });

    test("generates cryptographically unique codes", () => {
      const generatedOtps = new Set<string>();
      for (let iteration = 0; iteration < 1000; iteration++) {
        generatedOtps.add(generateOTP());
      }
      // With 10^6 possibilities and 1000 samples, collisions should be rare
      expect(generatedOtps.size).toBeGreaterThan(950);
    });

    test("generates codes with correct constant length", () => {
      expect(OTP_LENGTH).toBe(6);
      const otp = generateOTP();
      expect(otp.length).toBe(OTP_LENGTH);
    });
  });
});

describe("OTP Hashing", () => {
  describe("hashOTP", () => {
    test("produces deterministic hashes", async () => {
      const otp = "123456";
      const hash1 = await hashOTP(otp);
      const hash2 = await hashOTP(otp);
      expect(hash1).toBe(hash2);
    });

    test("produces different hashes for different OTPs", async () => {
      const hash1 = await hashOTP("123456");
      const hash2 = await hashOTP("654321");
      const hash3 = await hashOTP("000000");
      const hash4 = await hashOTP("999999");

      expect(hash1).not.toBe(hash2);
      expect(hash1).not.toBe(hash3);
      expect(hash1).not.toBe(hash4);
    });

    test("produces SHA-256 hex output (64 characters)", async () => {
      const hash = await hashOTP("123456");
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });

    test("is case-sensitive for input", async () => {
      // OTPs are numeric, but test shows hashing is input-sensitive
      const hash1 = await hashOTP("ABC123");
      const hash2 = await hashOTP("abc123");
      expect(hash1).not.toBe(hash2);
    });

    test("handles edge case OTPs", async () => {
      const hash1 = await hashOTP("000000");
      const hash2 = await hashOTP("999999");
      const hash3 = await hashOTP("111111");

      expect(hash1).toHaveLength(64);
      expect(hash2).toHaveLength(64);
      expect(hash3).toHaveLength(64);
    });
  });

  describe("verifyOTPHash", () => {
    test("returns true for correct OTP", async () => {
      const otp = "123456";
      const hash = await hashOTP(otp);
      const isValid = await verifyOTPHash(otp, hash);
      expect(isValid).toBe(true);
    });

    test("returns false for incorrect OTP", async () => {
      const otp = "123456";
      const hash = await hashOTP(otp);
      const isValid = await verifyOTPHash("654321", hash);
      expect(isValid).toBe(false);
    });

    test("returns false for similar OTPs", async () => {
      const otp = "123456";
      const hash = await hashOTP(otp);

      // Off by one
      expect(await verifyOTPHash("123457", hash)).toBe(false);
      expect(await verifyOTPHash("123455", hash)).toBe(false);
      expect(await verifyOTPHash("023456", hash)).toBe(false);
    });

    test("uses timing-safe comparison", async () => {
      const otp = "123456";
      const hash = await hashOTP(otp);

      // These should all take similar time regardless of match position
      const start1 = performance.now();
      await verifyOTPHash("000000", hash);
      const time1 = performance.now() - start1;

      const start2 = performance.now();
      await verifyOTPHash("123450", hash);
      const time2 = performance.now() - start2;

      const start3 = performance.now();
      await verifyOTPHash("999999", hash);
      const time3 = performance.now() - start3;

      // Times should be roughly similar (within 5ms tolerance)
      expect(Math.abs(time1 - time2)).toBeLessThan(5);
      expect(Math.abs(time2 - time3)).toBeLessThan(5);
    });
  });
});

describe("OTP Expiry", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("OTP_EXPIRY_MINUTES is 15 minutes", () => {
    expect(OTP_EXPIRY_MINUTES).toBe(15);
  });

  test("getOTPExpiry returns correct future date", () => {
    const now = new Date("2024-01-15T10:00:00Z");
    vi.setSystemTime(now);

    const expiry = getOTPExpiry();
    const expectedExpiry = new Date("2024-01-15T10:15:00Z");

    expect(expiry.getTime()).toBe(expectedExpiry.getTime());
  });

  test("expiry is exactly 15 minutes from now", () => {
    const now = new Date();
    vi.setSystemTime(now);

    const expiry = getOTPExpiry();
    const diffMs = expiry.getTime() - now.getTime();
    const diffMinutes = diffMs / (60 * 1000);

    expect(diffMinutes).toBe(OTP_EXPIRY_MINUTES);
  });
});

describe("OTP Attempts", () => {
  test("OTP_MAX_ATTEMPTS is 5", () => {
    expect(OTP_MAX_ATTEMPTS).toBe(5);
  });

  test("max attempts constant is reasonable security value", () => {
    // Too few attempts could lock out legitimate users
    expect(OTP_MAX_ATTEMPTS).toBeGreaterThanOrEqual(3);
    // Too many attempts could allow brute force
    expect(OTP_MAX_ATTEMPTS).toBeLessThanOrEqual(10);
  });
});

describe("OTP Storage (In-Memory Fallback)", () => {
  const testUserId = "test-user-123";

  beforeEach(async () => {
    // Clean up any existing OTP
    await deleteOtp(testUserId);
  });

  afterEach(async () => {
    await deleteOtp(testUserId);
  });

  describe("storeOtp", () => {
    test("stores OTP data successfully", async () => {
      const hash = await hashOTP("123456");
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

      const result = await storeOtp(testUserId, {
        hash,
        expiresAt,
        attempts: 0,
      });

      expect(result).toBe(true);
    });

    test("overwrites existing OTP for same user", async () => {
      const hash1 = await hashOTP("111111");
      const hash2 = await hashOTP("222222");
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

      await storeOtp(testUserId, { hash: hash1, expiresAt, attempts: 0 });
      await storeOtp(testUserId, { hash: hash2, expiresAt, attempts: 0 });

      const stored = await getOtp(testUserId);
      expect(stored?.hash).toBe(hash2);
    });
  });

  describe("getOtp", () => {
    test("retrieves stored OTP data", async () => {
      const hash = await hashOTP("123456");
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

      await storeOtp(testUserId, { hash, expiresAt, attempts: 2 });
      const stored = await getOtp(testUserId);

      expect(stored).not.toBeNull();
      expect(stored?.hash).toBe(hash);
      expect(stored?.attempts).toBe(2);
      expect(stored?.expiresAt.getTime()).toBe(expiresAt.getTime());
    });

    test("returns null for non-existent user", async () => {
      const stored = await getOtp("non-existent-user");
      expect(stored).toBeNull();
    });
  });

  describe("incrementAttempts", () => {
    test("increments attempt counter", async () => {
      const hash = await hashOTP("123456");
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

      await storeOtp(testUserId, { hash, expiresAt, attempts: 0 });
      await incrementAttempts(testUserId);

      const stored = await getOtp(testUserId);
      expect(stored?.attempts).toBe(1);
    });

    test("increments multiple times", async () => {
      const hash = await hashOTP("123456");
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

      await storeOtp(testUserId, { hash, expiresAt, attempts: 0 });

      await incrementAttempts(testUserId);
      await incrementAttempts(testUserId);
      await incrementAttempts(testUserId);

      const stored = await getOtp(testUserId);
      expect(stored?.attempts).toBe(3);
    });

    test("returns true on success", async () => {
      const hash = await hashOTP("123456");
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

      await storeOtp(testUserId, { hash, expiresAt, attempts: 0 });
      const result = await incrementAttempts(testUserId);

      expect(result).toBe(true);
    });
  });

  describe("deleteOtp", () => {
    test("removes stored OTP", async () => {
      const hash = await hashOTP("123456");
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

      await storeOtp(testUserId, { hash, expiresAt, attempts: 0 });
      await deleteOtp(testUserId);

      const stored = await getOtp(testUserId);
      expect(stored).toBeNull();
    });

    test("handles deleting non-existent OTP gracefully", async () => {
      // Should not throw
      await expect(deleteOtp("non-existent-user")).resolves.toBeUndefined();
    });
  });
});

describe("OTP Formatting", () => {
  describe("formatOTP", () => {
    test("formats 6-digit OTP with dash", () => {
      expect(formatOTP("123456")).toBe("123-456");
    });

    test("handles all zeros", () => {
      expect(formatOTP("000000")).toBe("000-000");
    });

    test("handles all nines", () => {
      expect(formatOTP("999999")).toBe("999-999");
    });

    test("returns original for wrong length", () => {
      expect(formatOTP("12345")).toBe("12345");
      expect(formatOTP("1234567")).toBe("1234567");
      expect(formatOTP("")).toBe("");
    });
  });
});

describe("OTP Security Properties", () => {
  test("OTP space is sufficient to prevent brute force", () => {
    // 6-digit numeric = 10^6 = 1,000,000 possibilities
    const possibleOtps = Math.pow(10, OTP_LENGTH);
    expect(possibleOtps).toBe(1000000);

    // With 5 attempts max, probability of guessing is 5/1000000 = 0.0005%
    const bruteForceChance = OTP_MAX_ATTEMPTS / possibleOtps;
    expect(bruteForceChance).toBeLessThan(0.00001); // Less than 0.001%
  });

  test("expiry window is reasonable for user experience", () => {
    // 15 minutes is enough time to check email and enter code
    expect(OTP_EXPIRY_MINUTES).toBeGreaterThanOrEqual(10);
    // But not so long that it creates security risk
    expect(OTP_EXPIRY_MINUTES).toBeLessThanOrEqual(30);
  });
});
