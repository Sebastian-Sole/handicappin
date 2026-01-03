import crypto from "crypto";
import { webcrypto } from "node:crypto";

export const OTP_LENGTH = 6;
export const OTP_EXPIRY_MINUTES = 15;
export const OTP_MAX_ATTEMPTS = 5;

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
 */
export async function verifyOTPHash(otp: string, hash: string): Promise<boolean> {
  const computedHash = await hashOTP(otp);

  // Convert to buffers for timing-safe comparison
  const computedBuffer = Buffer.from(computedHash, "utf8");
  const providedBuffer = Buffer.from(hash, "utf8");

  // Handle length mismatch (though SHA-256 hex should always be same length)
  if (computedBuffer.length !== providedBuffer.length) {
    // Compare against zeroed buffer to prevent early return timing leak
    const zeroBuffer = Buffer.alloc(computedBuffer.length);
    crypto.timingSafeEqual(computedBuffer, zeroBuffer);
    return false;
  }

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
