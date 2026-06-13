/**
 * Runtime environment for the native app — the single trust boundary between
 * Expo config (`app.config.ts` extra) and application code. Everything is
 * zod-validated at startup so a misconfigured build fails loudly at launch,
 * not deep inside an API call.
 *
 * Mirrors the role of `apps/web/env.ts` (@t3-oss/env-nextjs) on web: app code
 * imports `env` from here and never touches `process.env` / Constants.
 */
import Constants from "expo-constants";
import { z } from "zod";

const envSchema = z.object({
  /** Supabase project URL (local stack default: http://127.0.0.1:54321). */
  supabaseUrl: z.url(),
  /** Supabase anon (publishable) key — client-exposed by design. */
  supabaseAnonKey: z.string().min(1),
  /** Base URL of the Next.js app serving /api/trpc (dev: http://localhost:3000). */
  apiBaseUrl: z.url(),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const extra = Constants.expoConfig?.extra;
  const parsed = envSchema.safeParse(extra?.["env"]);
  if (!parsed.success) {
    throw new Error(
      `Invalid native app environment (app.config.ts extra.env): ${parsed.error.message}`,
    );
  }
  return parsed.data;
}

export const env: Env = loadEnv();
