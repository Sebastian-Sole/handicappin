/**
 * Vitest setup: default env validation OFF for tests.
 *
 * Modules that import `@/env` (e.g. `lib/rate-limit.ts`) run the full
 * @t3-oss/env-nextjs zod schema at import time. Tests must not require a
 * fully-populated `.env.local` (CI and fresh worktrees don't have one), so
 * validation is skipped by default.
 *
 * Tests that exercise the env schema itself re-enable it with
 * `vi.stubEnv("SKIP_ENV_VALIDATION", "")` — see
 * `tests/unit/lib/env-rate-limit-assert.test.ts`.
 */
process.env.SKIP_ENV_VALIDATION ||= "1";
