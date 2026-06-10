/**
 * Native facade for the web `stripe` tRPC router (read-only surface; the
 * purchase flows are mocked behind lib/billing per the decision ledger).
 */
import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";

import { trpcQuery } from "@/lib/api/client";

export const promoSlotsSchema = z.object({
  available: z.boolean(),
  remaining: z.number(),
  total: z.number(),
});

export type PromoSlots = z.infer<typeof promoSlotsSchema>;

export const promoSlotsQueryOptions = () =>
  queryOptions({
    queryKey: ["stripe.getPromoSlots"] as const,
    queryFn: () => trpcQuery("stripe.getPromoSlots", undefined, promoSlotsSchema),
  });
