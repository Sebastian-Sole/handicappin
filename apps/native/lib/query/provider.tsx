/**
 * App-root TanStack Query provider. Holds a single `QueryClient` across
 * re-renders (created lazily in a ref so a Fast-Refresh re-render doesn't
 * blow away the cache). Mount above the Expo Router stack.
 */
import type { QueryClient } from "@tanstack/react-query";
import { QueryClientProvider } from "@tanstack/react-query";
import { useRef, type ReactNode } from "react";

import { createQueryClient } from "@/lib/query/query-client";

export function QueryProvider({ children }: { children: ReactNode }) {
  const clientRef = useRef<QueryClient | null>(null);
  clientRef.current ??= createQueryClient();
  return (
    <QueryClientProvider client={clientRef.current}>
      {children}
    </QueryClientProvider>
  );
}
