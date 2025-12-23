"use client";
import { signupSchema } from "@/types/auth";
import { createClientComponentClient } from "../supabase/client";

export const signUpUser = async (values: signupSchema) => {
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
    // Check if email already exists but is unconfirmed
    if (signupError.message.includes("User already registered")) {
      // Attempt to resend verification email for unconfirmed user
      const PROJECT_ID = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const resendUrl = `${PROJECT_ID}/functions/v1/resend-verification-otp`;

      try {
        const resendResponse = await fetch(resendUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email: values.email }),
        });

        if (resendResponse.ok) {
          const { success, error: resendError } = await resendResponse.json();

          if (success) {
            // Successfully resent verification to unconfirmed account
            return;
          }

          // If resend failed due to already verified, throw original error
          if (resendError?.includes("already verified")) {
            throw new Error("Email already in use. Please login.");
          }
        }

        // For any other case, throw a user-friendly error
        throw new Error(
          "Email already in use. If you haven't verified your email, please check your inbox."
        );
      } catch (error) {
        // Log the original error for debugging
        console.error("Failed to resend verification email:", error);

        // If it's already a user-friendly error we threw, re-throw it
        if (error instanceof Error &&
            (error.message.includes("Email already in use") ||
             error.message.includes("Please login"))) {
          throw error;
        }

        // For network errors or other failures, throw a user-friendly message
        throw new Error(
          "Unable to resend verification email. Please try again or contact support."
        );
      }
    }

    throw signupError;
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

  // // Create user profile
  // const { error: profileError } = await supabase.from("Profile").insert([
  //   {
  //     email: values.email,
  //     name: values.name,
  //     handicapIndex: 54,
  //     id: signupData.user.id,
  //     verified: false,
  //   },
  // ]);

  // if (profileError) {
  //   throw profileError;
  // }
};
