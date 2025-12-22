import { describe, it, expect } from "vitest";
import { generateOTP, hashOTP, verifyOTPHash, formatOTP, OTP_LENGTH } from "./otp-utils";

describe("OTP Utilities", () => {
  describe("generateOTP", () => {
    it("generates 6-digit OTP", () => {
      const otp = generateOTP();
      expect(otp).toHaveLength(6);
      expect(otp).toMatch(/^\d{6}$/);
    });

    it("generates unique OTPs", () => {
      const otp1 = generateOTP();
      const otp2 = generateOTP();
      expect(otp1).not.toBe(otp2);
    });

    it("generates OTPs with correct length constant", () => {
      const otp = generateOTP();
      expect(otp.length).toBe(OTP_LENGTH);
    });

    it("pads OTPs with leading zeros if needed", () => {
      // Run multiple times to increase chance of getting a small number
      for (let i = 0; i < 50; i++) {
        const otp = generateOTP();
        expect(otp).toMatch(/^\d{6}$/);
        expect(otp.length).toBe(6);
      }
    });
  });

  describe("hashOTP", () => {
    it("hashes OTP consistently", () => {
      const otp = "123456";
      const hash1 = hashOTP(otp);
      const hash2 = hashOTP(otp);
      expect(hash1).toBe(hash2);
    });

    it("produces different hashes for different OTPs", () => {
      const hash1 = hashOTP("123456");
      const hash2 = hashOTP("654321");
      expect(hash1).not.toBe(hash2);
    });

    it("produces SHA-256 hash (64 hex characters)", () => {
      const hash = hashOTP("123456");
      expect(hash).toHaveLength(64); // SHA-256 produces 64 hex characters
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  describe("verifyOTPHash", () => {
    it("verifies OTP correctly", () => {
      const otp = "123456";
      const hash = hashOTP(otp);
      expect(verifyOTPHash(otp, hash)).toBe(true);
    });

    it("rejects incorrect OTP", () => {
      const otp = "123456";
      const hash = hashOTP(otp);
      expect(verifyOTPHash("654321", hash)).toBe(false);
    });

    it("rejects OTP with different case (case sensitive)", () => {
      const otp = "123456";
      const hash = hashOTP(otp);
      expect(verifyOTPHash("123457", hash)).toBe(false);
    });
  });

  describe("formatOTP", () => {
    it("formats OTP with dash", () => {
      expect(formatOTP("123456")).toBe("123-456");
    });

    it("formats OTP correctly with different values", () => {
      expect(formatOTP("000000")).toBe("000-000");
      expect(formatOTP("999999")).toBe("999-999");
    });

    it("returns original if length is not 6", () => {
      expect(formatOTP("12345")).toBe("12345");
      expect(formatOTP("1234567")).toBe("1234567");
      expect(formatOTP("")).toBe("");
    });
  });
});
