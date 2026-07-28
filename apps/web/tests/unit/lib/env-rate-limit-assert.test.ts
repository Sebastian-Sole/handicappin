/**
 * Startup env assertion for the rate-limit flag (subplan 001 / W0, step 3).
 *
 * `apps/web/env.ts` must reject a PRODUCTION environment where
 * `RATE_LIMIT_ENABLED` is unset: the public API surface fails closed when
 * the limiter can't run, so an unset flag in production is a
 * misconfiguration that must fail the deploy loudly at build/boot — not
 * fail closed (or open) silently at request time.
 *
 * Each case stubs a COMPLETE valid environment (no SKIP_ENV_VALIDATION) and
 * re-imports `@/env` so the real zod schema runs.
 */

import { describe, test, expect, vi, afterEach } from "vitest";

/** A complete, valid env per env.ts's server + client schemas. */
const VALID_ENV: Record<string, string> = {
  DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
  RESEND_API_KEY: "re_dummy",
  SEND_EMAIL_HOOK_SECRET: "dummy-hook-secret",
  STRIPE_SECRET_KEY: "sk_test_dummy",
  STRIPE_WEBHOOK_SECRET: "whsec_dummy",
  STRIPE_PREMIUM_PRICE_ID: "price_premium",
  STRIPE_UNLIMITED_PRICE_ID: "price_unlimited",
  STRIPE_UNLIMITED_LIFETIME_PRICE_ID: "price_lifetime",
  KV_URL: "redis://localhost:6379",
  KV_REST_API_URL: "https://dummy-kv.upstash.io",
  KV_REST_API_TOKEN: "dummy-kv-token",
  KV_REST_API_READ_ONLY_TOKEN: "dummy-kv-readonly-token",
  REDIS_URL: "redis://localhost:6379",
  ADMIN_ALERT_EMAILS: "admin@example.com",
  ADMIN_EMAILS: "admin@example.com",
  RESET_TOKEN_SECRET: "dummy-reset-secret",
  OPENAI_API_KEY: "sk-dummy",
  GOOGLE_CLIENT_SECRET: "dummy-google-secret",
  SUPABASE_SERVICE_ROLE_KEY: "dummy-service-role-key",
  HANDICAP_CRON_SECRET: "dummy-handicap-cron",
  STRIPE_CRON_SECRET: "dummy-stripe-cron",
  NEXT_PUBLIC_SUPABASE_URL: "https://dummy.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "dummy-anon-key",
  NEXT_PUBLIC_GOOGLE_CLIENT_ID: "dummy-google-client-id",
};

async function loadEnv(overrides: Record<string, string>) {
  vi.resetModules();
  // Force real validation (CI/dev machines may have this set elsewhere).
  vi.stubEnv("SKIP_ENV_VALIDATION", "");
  // Neutralize values leaked from .env.local, then apply the fixture.
  for (const key of [
    "RATE_LIMIT_ENABLED",
    "RATE_LIMIT_PUBLIC_API_PER_MIN",
    "RATE_LIMIT_CHECKOUT_PER_MIN",
    "RATE_LIMIT_PORTAL_PER_MIN",
    "RATE_LIMIT_WEBHOOK_PER_MIN",
    "RATE_LIMIT_CONTACT_PER_MIN",
    "RATE_LIMIT_DELETION_PER_HOUR",
    "RATE_LIMIT_OAUTH_CALLBACK_PER_MIN",
    "RATE_LIMIT_GOOGLE_TOKEN_PER_MIN",
    "RATE_LIMIT_CONSENT_PER_HOUR",
    "RATE_LIMIT_AI_EXTRACTION_PER_HOUR",
  ]) {
    vi.stubEnv(key, "");
  }
  for (const [key, value] of Object.entries({ ...VALID_ENV, ...overrides })) {
    vi.stubEnv(key, value);
  }
  return import("@/env");
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("env.ts — RATE_LIMIT_ENABLED production assertion", () => {
  test("production deploy with RATE_LIMIT_ENABLED unset fails loudly", async () => {
    await expect(
      loadEnv({ NODE_ENV: "production" })
    ).rejects.toThrow(/invalid environment variables/i);
  });

  test("production deploy with an explicit 'true' passes", async () => {
    const { env } = await loadEnv({
      NODE_ENV: "production",
      RATE_LIMIT_ENABLED: "true",
    });

    expect(env.RATE_LIMIT_ENABLED).toBe("true");
  });

  test("production deploy with an explicit 'false' passes (public API disabled/fail-closed; only first-party limiting is off)", async () => {
    const { env } = await loadEnv({
      NODE_ENV: "production",
      RATE_LIMIT_ENABLED: "false",
    });

    expect(env.RATE_LIMIT_ENABLED).toBe("false");
  });

  test("non-production environments may leave it unset", async () => {
    const { env } = await loadEnv({ NODE_ENV: "development" });

    expect(env.RATE_LIMIT_ENABLED).toBeUndefined();
  });

  test("garbage values are rejected in any environment", async () => {
    await expect(
      loadEnv({ NODE_ENV: "development", RATE_LIMIT_ENABLED: "yes" })
    ).rejects.toThrow(/invalid environment variables/i);
  });

  test("per-endpoint limits default and coerce from strings", async () => {
    const { env } = await loadEnv({
      NODE_ENV: "development",
      RATE_LIMIT_PUBLIC_API_PER_MIN: "120",
    });

    expect(env.RATE_LIMIT_PUBLIC_API_PER_MIN).toBe(120);
    expect(env.RATE_LIMIT_CHECKOUT_PER_MIN).toBe(10);
    expect(env.RATE_LIMIT_DELETION_PER_HOUR).toBe(3);
  });
});
