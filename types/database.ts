import { Tables } from "./supabase";

export type RoundWithCourse = Tables<"round"> & {
  // Flatten Course properties directly into RoundWithCourse
  courseName: Tables<"course">["name"];
  courseEighteenHolePar: Tables<"course">["eighteenHolePar"];
  courseNineHolePar: Tables<"course">["nineHolePar"];
  courseRating: Tables<"course">["courseRating"];
  courseSlope: Tables<"course">["slopeRating"];
  // Add other Course attributes here as needed
};
