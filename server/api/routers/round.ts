import { z } from "zod";

import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { roundSchema } from "@/types/round";

export const roundRouter = createTRPCRouter({
  create: publicProcedure
    .input(roundSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.db.round.create({
        data: {
          ...input,
        },
      });
    }),

  getLatest: publicProcedure.query(({ ctx }) => {
    return ctx.db.round.findFirst({
      orderBy: { createdAt: "desc" },
    });
  }),
});
