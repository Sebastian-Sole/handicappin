import crypto from "crypto";
import { webcrypto } from "node:crypto";
import { OTP_LENGTH, OTP_EXPIRY_MINUTES, OTP_MAX_ATTEMPTS } from "./otp-constants";

// Re-export constants for backwards compatibility
export { OTP_LENGTH, OTP_EXPIRY_MINUTES, OTP_MAX_ATTEMPTS };

/**
 * Generate a cryptographically secure 6-digit OTP
 */
export function generateOTP(): string {
  const buffer = crypto.randomBytes(4);
  const num = buffer.readUInt32BE(0);
  const otp = (num % 1000000).toString().padStart(OTP_LENGTH, "0");
  return otp;
}

/**
 * Hash OTP using SHA-256 for secure storage
 * Uses Web Crypto API for consistency with Deno version
 */
export async function hashOTP(otp: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(otp);
  const hashBuffer = await webcrypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  return hashHex;
}

/**
 * Verify OTP matches hash using timing-safe comparison
 * SHA-256 hashes are always 64 hex characters, so timingSafeEqual will throw if lengths differ
 */
export async function verifyOTPHash(otp: string, hash: string): Promise<boolean> {
  const computedHash = await hashOTP(otp);
  const computedBuffer = Buffer.from(computedHash, "utf8");
  const providedBuffer = Buffer.from(hash, "utf8");

  return crypto.timingSafeEqual(computedBuffer, providedBuffer);
}

/**
 * Get OTP expiration timestamp
 */
export function getOTPExpiry(): Date {
  return new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
}

/**
 * Format OTP for display (e.g., "123-456")
 */
export function formatOTP(otp: string): string {
  if (otp.length !== OTP_LENGTH) return otp;
  return `${otp.slice(0, 3)}-${otp.slice(3)}`;
}
