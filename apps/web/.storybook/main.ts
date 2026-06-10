import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";
import type { StorybookConfig } from "@storybook/nextjs";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// ---------------------------------------------------------------------
// Storybook env vars
//
// `env.ts` uses @t3-oss/env-nextjs and validates required env vars at
// module-eval time. Any story that transitively imports `@/env` (e.g.
// auth, billing, profile components) would crash with
// "Invalid environment variables" without these placeholders. Load
// `.env.storybook` before Storybook reads `process.env`.
//
// `override: false` (the default) means real env vars from the shell
// still win — developers can point Storybook at a real Supabase if they
// want.
// ---------------------------------------------------------------------
loadDotenv({ path: path.resolve(dirname, "../.env.storybook") });

const config: StorybookConfig = {
  stories: [
    "../components/**/*.stories.@(ts|tsx|mdx)",
    "../app/**/*.stories.@(ts|tsx|mdx)",
  ],
  addons: [
    "@storybook/addon-docs",
    "@storybook/addon-a11y",
    "@storybook/addon-themes",
    "@storybook/addon-vitest",
  ],
  framework: {
    name: "@storybook/nextjs",
    options: {},
  },
  typescript: {
    reactDocgen: "react-docgen-typescript",
  },
  staticDirs: ["../public"],
  docs: {
    defaultName: "Docs",
  },
  // ---------------------------------------------------------------------
  // Server-only module shims
  //
  // Storybook bundles client components with webpack5 directly and does
  // not honor Next.js's "use server" / "server-only" boundaries. Type-only
  // imports of `@/server/api/root` (in `trpc/react.tsx`) and any stray
  // reach into `@/db` end up trying to bundle `postgres`, which requires
  // Node built-ins (`net`, `tls`) that aren't available in the browser.
  //
  // We alias the server-only entry points to an empty stub so the module
  // graph terminates safely. None of these are actually invoked at story
  // render time — they exist only as types or as Server Actions that
  // stories don't trigger.
  // ---------------------------------------------------------------------
  webpackFinal: async (webpackConfig) => {
    const stub = path.resolve(dirname, "./mocks/server-stub.ts");
    const supabaseClientStub = path.resolve(
      dirname,
      "./mocks/supabase-client-stub.ts"
    );
    const projectRoot = path.resolve(dirname, "..");
    webpackConfig.resolve = webpackConfig.resolve ?? {};
    webpackConfig.resolve.alias = {
      ...(webpackConfig.resolve.alias ?? {}),
      "@/db$": stub,
      "@/db/index": stub,
      "@/server/api/root$": stub,
      "@/app/actions/email-change$": stub,
      postgres$: stub,
      // Replace the browser Supabase client so stories don't hit the network
      // and don't depend on real NEXT_PUBLIC_SUPABASE_* values working.
      "@/utils/supabase/client": supabaseClientStub,
    };
    webpackConfig.resolve.fallback = {
      ...(webpackConfig.resolve.fallback ?? {}),
      net: false,
      tls: false,
      fs: false,
      perf_hooks: false,
      dns: false,
      child_process: false,
    };

    // ---------------------------------------------------------------------
    // Inline NEXT_PUBLIC_* env vars into the browser bundle.
    //
    // `loadDotenv` above populates `process.env` in the Storybook Node
    // process, but `@storybook/nextjs` + webpack5 does not automatically
    // forward those values to the iframe bundle. Without this, `env.ts`
    // (which uses @t3-oss/env-nextjs) sees `undefined` at runtime and
    // throws "Invalid environment variables". DefinePlugin inlines the
    // string values at build time.
    // ---------------------------------------------------------------------
    // Resolve webpack via @storybook/nextjs since webpack is not a direct
    // dependency of this project (it's transitive through the framework).
    const storybookRequire = createRequire(
      require.resolve("@storybook/nextjs/package.json")
    );
    const webpack = storybookRequire("webpack");
    const publicEnv: Record<string, string> = {};
    for (const [key, value] of Object.entries(process.env)) {
      if (key.startsWith("NEXT_PUBLIC_") && typeof value === "string") {
        publicEnv[`process.env.${key}`] = JSON.stringify(value);
      }
    }
    // ---------------------------------------------------------------------
    // Hard-replace the real DB entry with the stub.
    //
    // `resolve.alias` for `@/db` is bypassed because the `@/*`
    // tsconfig-paths resolve plugin (from `@storybook/nextjs`) rewrites
    // `@/db` to the absolute `db/index.ts` before the alias gets a chance to
    // match — so the real module (which imports `dotenv` + `postgres` and
    // crashes in the browser on `process.stdout.isTTY`) ends up bundled.
    //
    // `NormalModuleReplacementPlugin` runs at `beforeResolve`/`afterResolve`
    // on the request itself, regardless of resolve-plugin ordering, so it
    // catches both the bare `@/db` request and the resolved `db/index.ts`
    // file path. Match the project's own `db/index.ts` only (anchored to the
    // project root) so we never touch `node_modules` or unrelated `db` dirs.
    // ---------------------------------------------------------------------
    const dbIndexPattern = new RegExp(
      `(^@/db$)|(${projectRoot.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/db/index(\\.ts)?$)`
    );
    webpackConfig.plugins = [
      ...(webpackConfig.plugins ?? []),
      new webpack.DefinePlugin(publicEnv),
      new webpack.NormalModuleReplacementPlugin(dbIndexPattern, stub),
    ];

    return webpackConfig;
  },
};

export default config;
