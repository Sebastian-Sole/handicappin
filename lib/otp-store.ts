import { getRedisClient } from "./rate-limit";
import { OTP_EXPIRY_MINUTES } from "./otp-constants";

const OTP_KEY_PREFIX = "otp:deletion:";

interface OtpData {
  hash: string;
  expiresAt: string; // ISO string for JSON serialization
  attempts: number;
}

/**
 * Redis-based OTP store for account deletion verification.
 * Uses Redis TTL for automatic cleanup of expired entries.
 * Falls back to in-memory storage if Redis is unavailable.
 */

// In-memory fallback for when Redis is not available
const fallbackStore = new Map<string, OtpData>();

function getKey(userId: string): string {
  return `${OTP_KEY_PREFIX}${userId}`;
}

/**
 * Store an OTP for a user
 * @returns true if stored successfully, false if Redis error
 */
export async function storeOtp(
  userId: string,
  data: { hash: string; expiresAt: Date; attempts: number }
): Promise<boolean> {
  const redis = getRedisClient();
  const otpData: OtpData = {
    hash: data.hash,
    expiresAt: data.expiresAt.toISOString(),
    attempts: data.attempts,
  };

  if (!redis) {
    console.warn("[OTP Store] Redis not available, using in-memory fallback");
    fallbackStore.set(userId, otpData);
    return true;
  }

  try {
    // Store with TTL slightly longer than expiry to allow for clock skew
    const ttlSeconds = (OTP_EXPIRY_MINUTES + 1) * 60;
    await redis.set(getKey(userId), JSON.stringify(otpData), { ex: ttlSeconds });
    return true;
  } catch (error) {
    console.error("[OTP Store] Failed to store OTP in Redis:", error);
    // Fall back to in-memory
    fallbackStore.set(userId, otpData);
    return true;
  }
}

/**
 * Retrieve OTP data for a user
 * @returns OTP data or null if not found
 */
export async function getOtp(
  userId: string
): Promise<{ hash: string; expiresAt: Date; attempts: number } | null> {
  const redis = getRedisClient();

  if (!redis) {
    const data = fallbackStore.get(userId);
    if (!data) return null;
    return {
      hash: data.hash,
      expiresAt: new Date(data.expiresAt),
      attempts: data.attempts,
    };
  }

  try {
    const data = await redis.get<string>(getKey(userId));
    if (!data) {
      // Check fallback store in case of previous Redis failure
      const fallbackData = fallbackStore.get(userId);
      if (!fallbackData) return null;
      return {
        hash: fallbackData.hash,
        expiresAt: new Date(fallbackData.expiresAt),
        attempts: fallbackData.attempts,
      };
    }

    const parsed: OtpData = typeof data === "string" ? JSON.parse(data) : data;
    return {
      hash: parsed.hash,
      expiresAt: new Date(parsed.expiresAt),
      attempts: parsed.attempts,
    };
  } catch (error) {
    console.error("[OTP Store] Failed to get OTP from Redis:", error);
    // Check fallback
    const fallbackData = fallbackStore.get(userId);
    if (!fallbackData) return null;
    return {
      hash: fallbackData.hash,
      expiresAt: new Date(fallbackData.expiresAt),
      attempts: fallbackData.attempts,
    };
  }
}

/**
 * Increment the attempts counter for an OTP
 * @returns true if updated successfully
 */
export async function incrementAttempts(userId: string): Promise<boolean> {
  const redis = getRedisClient();

  if (!redis) {
    const data = fallbackStore.get(userId);
    if (data) {
      data.attempts++;
    }
    return true;
  }

  try {
    const current = await getOtp(userId);
    if (!current) return false;

    const ttlSeconds = Math.max(
      1,
      Math.ceil((current.expiresAt.getTime() - Date.now()) / 1000)
    );

    const updated: OtpData = {
      hash: current.hash,
      expiresAt: current.expiresAt.toISOString(),
      attempts: current.attempts + 1,
    };

    await redis.set(getKey(userId), JSON.stringify(updated), { ex: ttlSeconds });
    return true;
  } catch (error) {
    console.error("[OTP Store] Failed to increment attempts in Redis:", error);
    // Try fallback
    const data = fallbackStore.get(userId);
    if (data) {
      data.attempts++;
    }
    return true;
  }
}

/**
 * Delete OTP data for a user
 */
export async function deleteOtp(userId: string): Promise<void> {
  const redis = getRedisClient();

  // Always clean up fallback store
  fallbackStore.delete(userId);

  if (!redis) {
    return;
  }

  try {
    await redis.del(getKey(userId));
  } catch (error) {
    console.error("[OTP Store] Failed to delete OTP from Redis:", error);
  }
}
