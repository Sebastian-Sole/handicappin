/**
 * Empty stub for server-only modules.
 *
 * Storybook bundles client components with webpack5 directly and does not
 * honor Next.js's "use server" / "server-only" boundaries the way the Next
 * builder does. When a client component (or its decorator) transitively
 * imports something that touches `@/db`, `@/server/api/root`, or a
 * `"use server"` action file, webpack ends up trying to bundle `postgres`,
 * which in turn requires Node built-ins (`net`, `tls`, `perf_hooks`) that
 * don't exist in the browser.
 *
 * This stub is aliased in `.storybook/main.ts` for several module ids:
 *   - `@/db` / `@/db/index`     -> consumed as `import { db } from "@/db"`
 *   - `postgres`                -> `import postgres from "postgres"` (callable
 *                                  default export)
 *   - `@/server/api/root`       -> `import { appRouter } from ...` + `AppRouter`
 *                                  type
 *   - `@/app/actions/email-change` -> `import { verifyEmailChangeOtp } from ...`
 *
 * Webpack treats this project's `.ts` files as ES modules, so we must use ESM
 * `export` syntax — `module.exports` is illegal and crashes the build. The
 * named exports below cover every symbol the codebase pulls from the aliased
 * targets; everything is a no-op Proxy/async function since none of these are
 * invoked in story render paths.
 */

/**
 * A Proxy that is callable, indexable, and thenable. Any property access
 * returns another callable Proxy, and calling it (e.g. `postgres(...)` or a
 * server action) also returns a Proxy / resolves to `undefined`. This satisfies
 * every consumer shape without knowing the exact API surface.
 */
function createDeepStub(): unknown {
  const handler: ProxyHandler<(...args: unknown[]) => unknown> = {
    get(_target, prop) {
      if (prop === "__esModule") return true;
      if (prop === Symbol.toPrimitive) return () => "";
      if (prop === "then") return undefined; // not a real thenable
      return createDeepStub();
    },
    apply() {
      return createDeepStub();
    },
  };
  // Base target is a function so the Proxy is callable (needed for `postgres`).
  return new Proxy(function noop() {} as (...args: unknown[]) => unknown, handler);
}

const stub = createDeepStub();

// Named exports consumed across the aliased targets.
// `@/db` / `@/db/index`
export const db = stub;
// `@/server/api/root`
export const appRouter = stub;
export type AppRouter = unknown;
// `@/app/actions/email-change` (server action)
export const verifyEmailChangeOtp = async (..._args: unknown[]) => undefined;

// Default export — covers `import postgres from "postgres"` (callable) and any
// `import x from "@/db"` style consumer.
export default stub;
