import type { ConfigContext, ExpoConfig } from "expo/config";

/**
 * Dynamic Expo config. The static base lives in app.json; this layer injects
 * the runtime environment the app reads through `lib/env.ts` (zod-validated).
 *
 * Defaults target the LOCAL dev stack (local Supabase via `supabase start`,
 * Next.js API on :3000 — both reachable from the iOS simulator as localhost).
 * Override per environment with EXPO_PUBLIC_* variables (e.g. in eas.json
 * profiles or the shell) — never by editing code.
 *
 * The fallback anon key is the WELL-KNOWN public demo key every local
 * Supabase stack ships with (`supabase start` prints it). It is not a secret.
 */
const LOCAL_SUPABASE_URL = "http://127.0.0.1:54321";
const LOCAL_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const LOCAL_API_BASE_URL = "http://localhost:3000";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: config.name ?? "Handicappin'",
  slug: config.slug ?? "handicappin",
  extra: {
    ...config.extra,
    env: {
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? LOCAL_SUPABASE_URL,
      supabaseAnonKey:
        process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? LOCAL_SUPABASE_ANON_KEY,
      apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? LOCAL_API_BASE_URL,
      // Billing seam switch (D-seam): unset → RevenueCat-shaped mock.
      revenueCatIosApiKey:
        process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY ?? null,
    },
  },
});
