/**
 * TanStack Query client factory — native twin of `apps/web/trpc/query-client.ts`.
 * No SSR here, so the dehydrate/hydrate superjson wiring is web-only; the
 * staleTime default is kept identical so both apps refetch on the same cadence.
 */
import { QueryClient } from "@tanstack/react-query";

export const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000,
        // RN has no window focus; navigation-driven refetch is enough.
        refetchOnWindowFocus: false,
      },
    },
  });
