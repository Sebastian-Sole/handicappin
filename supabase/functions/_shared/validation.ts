/**
 * Shared validation utilities for Supabase Edge Functions
 */
import { z } from "https://esm.sh/zod@3.24.1";

/**
 * Email validation schema
 * Uses Zod's built-in email validation which follows RFC 5322 standards
 */
export const emailSchema = z.string().email("Invalid email format");

/**
 * Validate email format
 * Returns null if valid, error message if invalid
 */
export function validateEmail(email: unknown): string | null {
  const result = emailSchema.safeParse(email);

  if (!result.success) {
    return result.error.errors[0]?.message || "Invalid email format";
  }

  return null;
}

/**
 * UUID validation schema
 */
export const uuidSchema = z.string().uuid("Invalid UUID format");

/**
 * 6-digit OTP validation schema
 */
export const otpSchema = z.string().regex(/^\d{6}$/, "OTP must be a 6-digit number");

/**
 * Validate OTP format
 * Returns null if valid, error message if invalid
 */
export function validateOTP(otp: unknown): string | null {
  const result = otpSchema.safeParse(otp);

  if (!result.success) {
    return result.error.errors[0]?.message || "Invalid OTP format";
  }

  return null;
}
