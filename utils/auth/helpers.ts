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

  // Log in the user
  const { data: loginData, error: loginError } =
    await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    });

  if (loginError) {
    throw loginError;
  }

  if (!loginData.session) {
    throw new Error("Session data is undefined after login.");
  }

  // Set the session client-side
  const { error: setSessionError } = await supabase.auth.setSession(
    loginData.session
  );

  if (setSessionError) {
    throw setSessionError;
  }

  // Create user profile
  const { error: profileError } = await supabase.from("Profile").insert([
    {
      email: values.email,
      name: values.name,
      handicapIndex: 54,
      id: signupData.user.id,
    },
  ]);

  if (profileError) {
    throw profileError;
  }

  return loginData;
};
