/**
 * tRPC transport for the native app — calls the SAME Next.js tRPC server the
 * web app uses (`apps/web/app/api/trpc`), authenticated per request with the
 * Supabase access token (`Authorization: Bearer` — validated server-side in
 * apps/web/server/api/trpc.ts via `supabase.auth.getUser(token)`).
 *
 * WHY UNTYPED + ZOD (decision logged in docs/native-implementation-log.md):
 * `AppRouter` cannot be type-imported across the app boundary — the two apps
 * have colliding `@/*` path aliases and strictly-isolated dependency graphs
 * (pnpm default linker), so pulling web's server type graph into native's
 * tsc program is not feasible. Instead, native treats the API as what it is
 * from this side: an external service. Every response crosses the trust
 * boundary through a zod schema (repo convention), giving RUNTIME shape
 * safety that compile-time inference alone would not. Procedure facades live
 * in `lib/api/procedures/`; this file is transport only.
 */
import { createTRPCUntypedClient, httpBatchLink } from "@trpc/client";
import type { AnyRouter } from "@trpc/server";
import superjson from "superjson";
import type { z } from "zod";

import { env } from "@/lib/env";
import { supabase } from "@/lib/supabase";

export const trpcClient = createTRPCUntypedClient<AnyRouter>({
  links: [
    httpBatchLink({
      transformer: superjson,
      url: `${env.apiBaseUrl}/api/trpc`,
      headers: async () => {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        return {
          "x-trpc-source": "native",
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        };
      },
    }),
  ],
});

/**
 * Run a tRPC query and validate the response at the trust boundary.
 * `path` is the dot-joined procedure path (e.g. "auth.getProfileFromUserId").
 */
export async function trpcQuery<TOutput>(
  path: string,
  input: unknown,
  schema: z.ZodType<TOutput>,
): Promise<TOutput> {
  const raw = await trpcClient.query(path, input);
  return schema.parse(raw);
}

/** Run a tRPC mutation and validate the response at the trust boundary. */
export async function trpcMutation<TOutput>(
  path: string,
  input: unknown,
  schema: z.ZodType<TOutput>,
): Promise<TOutput> {
  const raw = await trpcClient.mutation(path, input);
  return schema.parse(raw);
}
