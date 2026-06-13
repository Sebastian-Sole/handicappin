/**
 * Native port of apps/web/utils/auth/helpers.ts signUpUser — same sequence:
 * supabase.auth.signUp, then the create-profile edge function (the app's
 * real profile write path), surfacing the same error taxonomy the web
 * signup screen branches on. The email verification link targets the WEB
 * origin (emails are a web surface; native verification uses the OTP screen).
 */
import { z } from "zod";

import { env } from "@/lib/env";
import { LEGAL_VERSION } from "@/lib/legal";
import { supabase } from "@/lib/supabase";

export const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(3),
  legalConsent: z.boolean().refine((val) => val === true, {
    message: "You must agree to the Terms of Service and Privacy Policy",
  }),
});

export type SignupValues = z.infer<typeof signupSchema>;

export type SignUpResult =
  | { success: true }
  | { success: false; error: "email_in_use" | "unknown"; message: string };

const DEFAULT_HANDICAP_INDEX = 54;

export async function signUpUser(values: SignupValues): Promise<SignUpResult> {
  const { data: signupData, error: signupError } = await supabase.auth.signUp({
    email: values.email,
    password: values.password,
    options: {
      emailRedirectTo: `${env.apiBaseUrl}/verify-email`,
    },
  });

  if (signupError) {
    if (signupError.code === "user_already_exists") {
      return {
        success: false,
        error: "email_in_use",
        message: "Email already in use",
      };
    }
    return { success: false, error: "unknown", message: signupError.message };
  }

  if (!signupData.user?.id) {
    throw new Error("User ID is undefined after signup.");
  }

  const response = await fetch(`${env.supabaseUrl}/functions/v1/create-profile`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.supabaseAnonKey}`,
    },
    body: JSON.stringify({
      email: values.email,
      name: values.name,
      handicapIndex: DEFAULT_HANDICAP_INDEX,
      userId: signupData.user.id,
      legalVersion: LEGAL_VERSION,
      acceptanceMethod: "signup",
    }),
  });

  if (!response.ok) {
    let message = "Failed to create profile.";
    try {
      const body: unknown = await response.json();
      if (
        typeof body === "object" &&
        body !== null &&
        typeof (body as Record<string, unknown>)["error"] === "string"
      ) {
        message = (body as Record<string, string>)["error"];
      }
    } catch {
      // keep default message
    }
    throw new Error(message);
  }

  return { success: true };
}
