import { RoundWithCourseAndTee } from "@/types/database";
import { Tables } from "@/types/supabase";

export const flattenRoundWithCourse = (
  round: Tables<"round">,
  course: Tables<"course"> | null
): RoundWithCourseAndTee | null => {
  if (course) {
    return {
      ...round,
      courseName: course.name,
      courseRating: course.courseRating,
      courseSlope: course.slopeRating,
      courseEighteenHolePar: course.eighteenHolePar,
      courseNineHolePar: course.nineHolePar,
    };
  }
  return null;
};
