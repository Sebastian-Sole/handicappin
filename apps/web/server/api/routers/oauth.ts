import { z } from "zod";

import { authedProcedure, createTRPCRouter } from "../trpc";
import { captureApiConnectCompleted } from "@/lib/api-platform/analytics";
import { logger } from "@/lib/logging";

/**
 * OAuth Connect-flow analytics surface (api-platform plan 010 T12, D9).
 *
 * The consent approval itself happens browser → GoTrue (`supabase.auth.
 * oauth.approveAuthorization` in `components/auth/oauth-consent-card.tsx`)
 * — there is no first-party server handler on that hop. So the server-owned
 * `api_connect_completed` event (DEMAND_INSTRUMENTATION.md §3.4) is captured
 * here: the consent card calls this mutation after a successful approval,
 * and the procedure re-verifies against GoTrue that a grant for the claimed
 * client actually exists for the session user before capturing. That keeps
 * the event a server-verified fact rather than a client-reported claim.
 *
 * Fail-open by design: the card fires this before following the redirect,
 * and a lost analytics event must never block or break the Connect flow —
 * verification misses and GoTrue errors return `{ captured: false }`
 * instead of throwing.
 */

const connectCompletedInput = z.object({
  /** GoTrue OAuth client id (UUID) shown on the consent card. */
  clientId: z.string().uuid(),
});

export const oauthRouter = createTRPCRouter({
  connectCompleted: authedProcedure
    .input(connectCompletedInput)
    .mutation(async ({ ctx, input }) => {
      const { data: grants, error } = await ctx.supabase.auth.oauth.listGrants();

      if (error || !grants) {
        logger.warn("connectCompleted: could not verify OAuth grant", {
          error: error?.message,
        });
        return { captured: false };
      }

      const grantExists = grants.some(
        (grant) => grant.client.id === input.clientId,
      );
      if (!grantExists) {
        // No grant for the claimed client — nothing to record.
        return { captured: false };
      }

      await captureApiConnectCompleted({
        userId: ctx.user.id,
        consumer: input.clientId,
      });

      return { captured: true };
    }),
});
