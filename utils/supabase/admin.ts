import { createClient } from "@supabase/supabase-js";
import { env } from "@/env";
import type { Database } from "@/types/supabase";

/**
 * Creates a Supabase client with service role key for admin operations.
 * WARNING: This bypasses Row Level Security. Only use in secure server contexts.
 */
export function createAdminClient() {
  return createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
