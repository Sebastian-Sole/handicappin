import { configDefaults, defineConfig } from "vitest/config";
import path from "path";
import dotenv from "dotenv";

// Load environment variables from .env.local (same as Next.js)
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    // Default env validation OFF so importing "@/env" never requires a
    // fully-populated .env.local in tests (see tests/setup-env.ts).
    setupFiles: ["tests/setup-env.ts"],
    env: {
      /**
       * The test run is pinned to a NON-UTC zone, on purpose.
       *
       * `toUtcIsoString` (`app/api/v1/_lib/serializers/round.ts`) exists
       * because `round.teeTime` / `createdAt` are `timestamp` WITHOUT time
       * zone: PostgREST returns `"2026-07-01T10:00:00"` with no designator,
       * and `new Date()` on an offset-less ISO date-time is defined to be
       * LOCAL time. A regression in that canonicalization — deleting the
       * designator check outright, for instance — is **entirely invisible
       * under UTC**: the suite stays green. GitHub runners are UTC, so CI
       * would never catch a reintroduction, on the exact field the round
       * natural key and §2's replay comparison both key on.
       *
       * Pinned HERE rather than as a `TZ=` prefix on `test:unit` or as a CI
       * matrix leg, for two reasons: it is one place that covers every
       * entrypoint (`test`, `test:unit`, `test:integration`, `test:coverage`,
       * `test:watch`) and every runner including a developer's laptop, so the
       * guarantee cannot be lost by someone adding a script; and a CI-only
       * matrix leg would surface the failure after push instead of before
       * commit.
       *
       * `Asia/Tokyo` specifically: +09:00 year-round with NO daylight saving,
       * so the offset is a constant. A DST zone would make the local offset
       * depend on the date in each fixture and could turn a genuine assertion
       * into a seasonal flake.
       */
      TZ: "Asia/Tokyo",
    },
    // Workspace packages run their own suites (packages/tokens uses
    // `node --test`, which Vitest can't collect); the root run covers
    // app code only.
    exclude: [...configDefaults.exclude, "packages/**"],
  },
  resolve: {
    alias: {
      // Workspace-package safety net: pnpm normally resolves
      // `@handicappin/handicap-core` via the symlink in `node_modules/`, but a
      // bad CI cache or a missing `pnpm install` can leave the symlink absent
      // and cause tests to silently skip imports. Pinning the alias to the
      // package's source entry guarantees Vitest finds the module.
      "@handicappin/handicap-core": path.resolve(
        __dirname,
        "../../packages/handicap-core/src/index.ts"
      ),
      "@handicappin/analytics": path.resolve(
        __dirname,
        "../../packages/analytics/src/index.ts"
      ),
      "@": path.resolve(__dirname, "./"),
    },
  },
});
