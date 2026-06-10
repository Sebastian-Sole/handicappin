/**
 * Supabase client for the native app.
 *
 * Sessions persist in the iOS keychain via expo-secure-store (per the
 * handoff: secure storage, not AsyncStorage). Known caveat, logged in
 * docs/native-implementation-log.md: Android's SecureStore warns above
 * 2048-byte values; the iOS keychain (our sim-complete target) has no such
 * limit. Revisit with a chunking adapter before an Android milestone.
 *
 * The web server validates our access token per request
 * (`Authorization: Bearer` → `supabase.auth.getUser(token)` in
 * apps/web/server/api/trpc.ts), so keeping the session fresh here is what
 * keeps tRPC authenticated.
 */
import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";

import { env } from "@/lib/env";

const secureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) =>
    SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

export const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey, {
  auth: {
    storage: secureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    // No browser URL to inspect on native; deep-link sessions are handled
    // explicitly where needed (e.g. password recovery).
    detectSessionInUrl: false,
  },
});
