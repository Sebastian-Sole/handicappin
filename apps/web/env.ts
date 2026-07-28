import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  /**
   * Specify your server-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars.
   */
  server: {
    DATABASE_URL: z.url(),
    RESEND_API_KEY: z.string(),
    SEND_EMAIL_HOOK_SECRET: z.string(),

    STRIPE_SECRET_KEY: z.string(),
    STRIPE_WEBHOOK_SECRET: z.string(),
    STRIPE_PREMIUM_PRICE_ID: z.string(),
    STRIPE_UNLIMITED_PRICE_ID: z.string(),
    STRIPE_UNLIMITED_LIFETIME_PRICE_ID: z.string(),

    // RevenueCat (Apple billing). Optional in dev: the webhook fails closed
    // in production when the auth token is unset; the reconcile script
    // skips Apple-side checks without the API key.
    REVENUECAT_WEBHOOK_AUTH_TOKEN: z.string().optional(),
    REVENUECAT_API_KEY: z.string().optional(),

    KV_URL: z.url(),
    KV_REST_API_URL: z.url(),
    KV_REST_API_TOKEN: z.string(),
    KV_REST_API_READ_ONLY_TOKEN: z.string(),
    REDIS_URL: z.url(),

    ADMIN_ALERT_EMAILS: z.string(),
    // Who may moderate (admin console access). Deliberately separate from
    // ADMIN_ALERT_EMAILS (who receives notification emails) — see plans/002.
    ADMIN_EMAILS: z.string(),
    RESET_TOKEN_SECRET: z.string(),

    OPENAI_API_KEY: z.string().min(1),
    GOOGLE_CLIENT_SECRET: z.string().min(1),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
    HANDICAP_CRON_SECRET: z.string().min(1),
    STRIPE_CRON_SECRET: z.string().min(1),

    // Optional handicap queue configuration
    HANDICAP_QUEUE_BATCH_SIZE: z.coerce.number().int().positive().default(25),
    HANDICAP_MAX_RETRIES: z.coerce.number().int().positive().default(3),

    // Rate limiting (lib/rate-limit.ts). RATE_LIMIT_ENABLED must be set
    // EXPLICITLY in production: the public API surface fails closed when the
    // limiter cannot run, so an unset flag in a production deploy is treated
    // as a misconfiguration and fails the build/boot loudly instead of
    // failing open (or closed) silently at request time.
    // NOTE: 'false' is NOT "public API without rate limiting" — on the
    // public API surface ('/api/v1', api.handicappin.com) both 'false' and
    // unset DENY 100% of requests (fail-closed). 'false' means "public API
    // disabled"; it only skips limiting on first-party web endpoints. See
    // docs/ingress-firewall-state.md and api-platform subplan 001 (W0).
    RATE_LIMIT_ENABLED: z
      .enum(["true", "false"])
      .optional()
      .refine(
        (value) =>
          process.env.NODE_ENV !== "production" || value !== undefined,
        {
          message:
            "RATE_LIMIT_ENABLED must be explicitly 'true' or 'false' in production — public API paths fail closed when the limiter is unavailable",
        }
      ),
    RATE_LIMIT_PUBLIC_API_PER_MIN: z.coerce.number().int().positive().default(60),
    RATE_LIMIT_CHECKOUT_PER_MIN: z.coerce.number().int().positive().default(10),
    RATE_LIMIT_PORTAL_PER_MIN: z.coerce.number().int().positive().default(5),
    RATE_LIMIT_WEBHOOK_PER_MIN: z.coerce.number().int().positive().default(100),
    RATE_LIMIT_CONTACT_PER_MIN: z.coerce.number().int().positive().default(3),
    RATE_LIMIT_DELETION_PER_HOUR: z.coerce.number().int().positive().default(3),
    RATE_LIMIT_OAUTH_CALLBACK_PER_MIN: z.coerce
      .number()
      .int()
      .positive()
      .default(10),
    RATE_LIMIT_GOOGLE_TOKEN_PER_MIN: z.coerce
      .number()
      .int()
      .positive()
      .default(10),
    RATE_LIMIT_CONSENT_PER_HOUR: z.coerce.number().int().positive().default(5),
    RATE_LIMIT_AI_EXTRACTION_PER_HOUR: z.coerce
      .number()
      .int()
      .positive()
      .default(20),

    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
  },

  /**
   * Specify your client-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars. To expose them to the client, prefix them with
   * `NEXT_PUBLIC_`.
   */
  client: {
    NEXT_PUBLIC_SUPABASE_URL: z.url(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string(),
    NEXT_PUBLIC_GOOGLE_CLIENT_ID: z.string().min(1),
    // PostHog product analytics (EU cloud). Both optional: analytics is
    // fail-open — key absent → no-op client, never a runtime error.
    NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN: z.string().min(1).optional(),
    NEXT_PUBLIC_POSTHOG_HOST: z.url().optional(),
  },

  /**
   * You can't destruct `process.env` as a regular object in the Next.js edge runtimes (e.g.
   * middlewares) or client-side so we need to destruct manually.
   */
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    SEND_EMAIL_HOOK_SECRET: process.env.SEND_EMAIL_HOOK_SECRET,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    STRIPE_PREMIUM_PRICE_ID: process.env.STRIPE_PREMIUM_PRICE_ID,
    STRIPE_UNLIMITED_PRICE_ID: process.env.STRIPE_UNLIMITED_PRICE_ID,
    STRIPE_UNLIMITED_LIFETIME_PRICE_ID:
      process.env.STRIPE_UNLIMITED_LIFETIME_PRICE_ID,
    REVENUECAT_WEBHOOK_AUTH_TOKEN: process.env.REVENUECAT_WEBHOOK_AUTH_TOKEN,
    REVENUECAT_API_KEY: process.env.REVENUECAT_API_KEY,
    KV_URL: process.env.KV_URL,
    KV_REST_API_URL: process.env.KV_REST_API_URL,
    KV_REST_API_TOKEN: process.env.KV_REST_API_TOKEN,
    KV_REST_API_READ_ONLY_TOKEN: process.env.KV_REST_API_READ_ONLY_TOKEN,
    REDIS_URL: process.env.REDIS_URL,
    ADMIN_ALERT_EMAILS: process.env.ADMIN_ALERT_EMAILS,
    ADMIN_EMAILS: process.env.ADMIN_EMAILS,
    RESET_TOKEN_SECRET: process.env.RESET_TOKEN_SECRET,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    HANDICAP_CRON_SECRET: process.env.HANDICAP_CRON_SECRET,
    STRIPE_CRON_SECRET: process.env.STRIPE_CRON_SECRET,
    HANDICAP_QUEUE_BATCH_SIZE: process.env.HANDICAP_QUEUE_BATCH_SIZE,
    HANDICAP_MAX_RETRIES: process.env.HANDICAP_MAX_RETRIES,
    RATE_LIMIT_ENABLED: process.env.RATE_LIMIT_ENABLED,
    RATE_LIMIT_PUBLIC_API_PER_MIN: process.env.RATE_LIMIT_PUBLIC_API_PER_MIN,
    RATE_LIMIT_CHECKOUT_PER_MIN: process.env.RATE_LIMIT_CHECKOUT_PER_MIN,
    RATE_LIMIT_PORTAL_PER_MIN: process.env.RATE_LIMIT_PORTAL_PER_MIN,
    RATE_LIMIT_WEBHOOK_PER_MIN: process.env.RATE_LIMIT_WEBHOOK_PER_MIN,
    RATE_LIMIT_CONTACT_PER_MIN: process.env.RATE_LIMIT_CONTACT_PER_MIN,
    RATE_LIMIT_DELETION_PER_HOUR: process.env.RATE_LIMIT_DELETION_PER_HOUR,
    RATE_LIMIT_OAUTH_CALLBACK_PER_MIN:
      process.env.RATE_LIMIT_OAUTH_CALLBACK_PER_MIN,
    RATE_LIMIT_GOOGLE_TOKEN_PER_MIN:
      process.env.RATE_LIMIT_GOOGLE_TOKEN_PER_MIN,
    RATE_LIMIT_CONSENT_PER_HOUR: process.env.RATE_LIMIT_CONSENT_PER_HOUR,
    RATE_LIMIT_AI_EXTRACTION_PER_HOUR:
      process.env.RATE_LIMIT_AI_EXTRACTION_PER_HOUR,
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_GOOGLE_CLIENT_ID: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
    NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN: process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN,
    NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
  },
  /**
   * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially
   * useful for Docker builds.
   */
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  /**
   * Makes it so that empty strings are treated as undefined. `SOME_VAR: z.string()` and
   * `SOME_VAR=''` will throw an error.
   */
  emptyStringAsUndefined: true,
});
