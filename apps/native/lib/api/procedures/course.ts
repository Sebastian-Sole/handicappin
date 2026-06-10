/** Native facade for the web `course` + `tee` tRPC routers. */
import { queryOptions } from "@tanstack/react-query";

import { trpcQuery } from "@/lib/api/client";
import {
  courseRowSchema,
  teeInfoRowSchema,
} from "@/lib/api/schemas/round";

export const courseByIdQueryOptions = (courseId: number) =>
  queryOptions({
    queryKey: ["course.getCourseById", courseId] as const,
    queryFn: () =>
      trpcQuery(
        "course.getCourseById",
        { courseId },
        courseRowSchema.nullable(),
      ),
  });

export const teeByIdQueryOptions = (teeId: number) =>
  queryOptions({
    queryKey: ["tee.getTeeById", teeId] as const,
    queryFn: () =>
      trpcQuery("tee.getTeeById", { teeId }, teeInfoRowSchema.nullable()),
  });
