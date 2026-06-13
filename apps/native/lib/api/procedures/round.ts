/** Native facade for the web `round` tRPC router (query-option factories). */
import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";

import { trpcQuery } from "@/lib/api/client";
import {
  roundRowSchema,
  roundsResponseSchema,
} from "@/lib/api/schemas/round";

export const roundsQueryOptions = (userId: string, amount?: number) =>
  queryOptions({
    queryKey: ["round.getAllByUserId", userId, amount ?? null] as const,
    queryFn: () =>
      trpcQuery(
        "round.getAllByUserId",
        amount === undefined ? { userId } : { userId, amount },
        roundsResponseSchema,
      ),
  });

export const bestRoundQueryOptions = (userId: string) =>
  queryOptions({
    queryKey: ["round.getBestRound", userId] as const,
    queryFn: () =>
      trpcQuery(
        "round.getBestRound",
        { userId },
        roundRowSchema.nullable(),
      ),
  });

export const roundCountQueryOptions = (userId: string) =>
  queryOptions({
    queryKey: ["round.getCountByUserId", userId] as const,
    queryFn: () =>
      trpcQuery("round.getCountByUserId", { userId }, z.number()),
  });
