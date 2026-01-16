/**
 * Deno-compatible OTP utilities (no Node.js crypto)
 */

export const OTP_LENGTH = 6;
export const OTP_EXPIRY_MINUTES = 15;
export const OTP_MAX_ATTEMPTS = 5;

/**
 * Generate a cryptographically secure 6-digit OTP (Deno)
 */
export function generateOTP(): string {
  const buffer = new Uint8Array(4);
  crypto.getRandomValues(buffer);
  const num = new DataView(buffer.buffer).getUint32(0, false);
  const otp = (num % 1000000).toString().padStart(OTP_LENGTH, "0");
  return otp;
}

/**
 * Hash OTP using SHA-256 for secure storage (Deno)
 */
export async function hashOTP(otp: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(otp);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  return hashHex;
}

/**
 * Verify OTP matches hash using constant-time comparison (Deno)
 * Prevents timing attacks by ensuring comparison always takes the same time
 */
export async function verifyOTPHash(otp: string, hash: string): Promise<boolean> {
  const computedHash = await hashOTP(otp);

  // Convert strings to byte arrays for constant-time comparison
  const encoder = new TextEncoder();
  const computedBytes = encoder.encode(computedHash);
  const providedBytes = encoder.encode(hash);

  // Defense in depth: Handle length mismatch with constant-time dummy comparison
  // This prevents early return timing leaks
  if (computedBytes.length !== providedBytes.length) {
    // Perform dummy constant-time comparison against zeroed buffer
    // This ensures timing is consistent even when lengths don't match
    const zeroBuffer = new Uint8Array(computedBytes.length);
    let dummy = 0;
    for (let i = 0; i < computedBytes.length; i++) {
      dummy |= computedBytes[i] ^ zeroBuffer[i];
    }
    // Always return false for length mismatch (dummy comparison prevents timing leak)
    return false;
  }

  // Constant-time comparison: XOR all bytes and accumulate result
  // Result is 0 only if all bytes match
  let result = 0;
  for (let i = 0; i < computedBytes.length; i++) {
    result |= computedBytes[i] ^ providedBytes[i];
  }

  return result === 0;
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
