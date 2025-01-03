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

  const PROJECT_ID = process.env.NEXT_PUBLIC_SUPABASE_URL;

  const URL = `${PROJECT_ID}/functions/v1/create-profile`;

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
