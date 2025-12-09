import { Database } from "@/types/supabase";
import { createBrowserClient } from "@supabase/ssr";

export function createClientComponentClient() {
  // Use default browser client - handles cookies automatically
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
