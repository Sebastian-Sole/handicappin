/**
 * Native facade for the web `auth` tRPC router — query-option factories the
 * screens feed to TanStack Query. Response shapes are validated at the trust
 * boundary (see lib/api/client.ts for why this replaces AppRouter inference).
 */
import { queryOptions } from "@tanstack/react-query";

import { trpcQuery } from "@/lib/api/client";
import { profileSchema } from "@/lib/api/schemas/profile";

export const profileQueryOptions = (userId: string) =>
  queryOptions({
    queryKey: ["auth.getProfileFromUserId", userId] as const,
    queryFn: () =>
      trpcQuery("auth.getProfileFromUserId", userId, profileSchema),
  });
