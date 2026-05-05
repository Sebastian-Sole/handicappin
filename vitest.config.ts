import { defineConfig } from "vitest/config";
import path from "path";
import dotenv from "dotenv";

// Load environment variables from .env.local (same as Next.js)
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
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
        "packages/handicap-core/src/index.ts"
      ),
      "@": path.resolve(__dirname, "./"),
    },
  },
});
