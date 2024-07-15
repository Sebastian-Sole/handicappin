import { Tables } from "./supabase";

export type RoundWithCourse = Tables<"Round"> & {
  // Flatten Course properties directly into RoundWithCourse
  courseName: Tables<"Course">["name"];
  courseEighteenHolePar: Tables<"Course">["eighteenHolePar"];
  courseNineHolePar: Tables<"Course">["nineHolePar"];
  courseRating: Tables<"Course">["courseRating"];
  courseSlope: Tables<"Course">["slopeRating"];
  // Add other Course attributes here as needed
};
