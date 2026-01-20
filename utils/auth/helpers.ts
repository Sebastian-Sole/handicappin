"use client";
import { signupSchema } from "@/types/auth";
import { createClientComponentClient } from "../supabase/client";

export type SignUpResult =
  | { success: true }
  | { success: false; error: "email_in_use" | "unknown"; message: string };

export const signUpUser = async (values: signupSchema): Promise<SignUpResult> => {
  const supabase = createClientComponentClient();

  // Use the current origin for the redirect URL
  const baseUrl = window.location.origin;

  // Sign up the user
  const { data: signupData, error: signupError } = await supabase.auth.signUp({
    email: values.email,
    password: values.password,
    options: {
      emailRedirectTo: `${baseUrl}/verify-email`,
    },
  });

  if (signupError) {
    // Check if email already exists
    if (signupError.code === "user_already_exists") {
      return {
        success: false,
        error: "email_in_use",
        message: "Email already in use"
      };
    }

    return {
      success: false,
      error: "unknown",
      message: signupError.message
    };
  }

  if (!signupData.user?.id) {
    throw new Error("User ID is undefined after signup.");
  }

  const PROJECT_ID = process.env.NEXT_PUBLIC_SUPABASE_URL;

  const URL = `${PROJECT_ID}/functions/v1/create-profile`;

  try {
    const response = await fetch(URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        email: values.email,
        name: values.name,
        handicapIndex: 54,
        userId: signupData.user.id,
      }),
    });

    if (!response.ok) {
      const { error } = await response.json();
      throw new Error(error || "Failed to create profile.");
    }
  } catch (error) {
    // Log the original error for debugging
    console.error("Failed to create profile:", error);

    // If it's already a user-friendly error we threw, re-throw it
    if (error instanceof Error && error.message.includes("Failed to create profile")) {
      throw error;
    }

    // For network errors or other failures, throw a user-friendly message
    throw new Error(
      "Unable to create your profile. Please try again or contact support."
    );
  }

  return { success: true };
};
