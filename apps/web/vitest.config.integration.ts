/**
 * Config for `pnpm test:integration` ONLY.
 *
 * Extends the base `vitest.config.ts` with two integration-specific pieces
 * that must NOT apply to unit runs:
 *
 * - `globalSetup: stack-preflight` — fails the run loudly when the local
 *   Supabase stack is unreachable, instead of letting 21 stack-gated suite
 *   files `describe.skip` themselves into a green no-op. Opt out with
 *   `ALLOW_INTEGRATION_SKIP=1` (CI does, explicitly).
 * - `IntegrationSummaryReporter` — prints how many test files executed vs
 *   fully skipped, so a partially-skipped run states so in its output.
 */
import { defineConfig, mergeConfig } from "vitest/config";
import baseConfig from "./vitest.config";
import { IntegrationSummaryReporter } from "./tests/integration/summary-reporter";

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      include: ["tests/integration/**/*.test.ts"],
      globalSetup: ["tests/integration/stack-preflight.ts"],
      reporters: ["default", new IntegrationSummaryReporter()],
    },
  })
);
