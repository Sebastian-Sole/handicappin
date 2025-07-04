import { Tables } from "./supabase";

export type RoundWithCourseAndTee = Tables<"round"> & Tables<"course"> & Tables<"teeInfo">
