"use client";
import { signupSchema } from "@/types/auth";
import { createClientComponentClient } from "../supabase/client";

export const signUpAndLogin = async (values: signupSchema) => {
  const supabase = createClientComponentClient();

  // Sign up the user
  const { data: signupData, error: signupError } = await supabase.auth.signUp({
    email: values.email,
    password: values.password,
  });

  if (signupError) {
    throw signupError;
  }

  if (!signupData.user?.id) {
    throw new Error("User ID is undefined after signup.");
  }

  console.log("User id:");
  console.log(signupData.user.id);

  // Create user profile
  const { error: profileError } = await supabase.from("Profile").insert([
    {
      email: values.email,
      name: values.name,
      handicapIndex: 54,
      id: signupData.user.id,
      verified: false,
    },
  ]);

  if (profileError) {
    throw profileError;
  }
};
