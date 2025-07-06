import { createCallerFactory, createTRPCRouter } from "@/server/api/trpc";
import { roundRouter } from "./routers/round";
import { authRouter } from "./routers/auth";
import { holeRouter } from "./routers/hole";
import { courseRouter } from "./routers/course";
import { teeRouter } from "./routers/tee";
import { scorecardRouter } from "./routers/scorecard";


/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  round: roundRouter,
  auth: authRouter,
  hole: holeRouter,
  course: courseRouter,
  tee: teeRouter,
  scorecard: scorecardRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.post.all();
 *       ^? Post[]
 */
export const createCaller = createCallerFactory(appRouter);
