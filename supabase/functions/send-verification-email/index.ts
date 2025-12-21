// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

import EmailOTP from "./email-otp.tsx";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";
import * as React from "https://esm.sh/react@18.2.0";
import { render } from "https://esm.sh/@react-email/components@0.0.22?deps=react@18.2.0";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { generateOTP, hashOTP, getOTPExpiry } from "../_shared/otp-utils.ts";

// This is from supabase docs: https://supabase.com/docs/guides/auth/auth-hooks/send-email-hook
console.log("send-verification-email (OTP-based)");

const resend = new Resend(Deno.env.get("RESEND_API_KEY") as string);
const hookSecret = (Deno.env.get("SEND_EMAIL_HOOK_SECRET") as string).replace(
  "v1,whsec_",
  ""
);

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("not allowed", { status: 400 });
  }

  const payload = await req.text();
  const headers = Object.fromEntries(req.headers);
  const wh = new Webhook(hookSecret);

  console.log("Calling send-verification-email inside");

  try {
    const {
      user,
      email_data: { email_action_type },
    } = wh.verify(payload, headers) as {
      user: {
        id: string;
        email: string;
      };
      email_data: {
        token: string;
        token_hash: string;
        redirect_to: string;
        email_action_type: string;
        site_url: string;
        token_new: string;
        token_hash_new: string;
      };
    };

    // Only handle signup verification
    if (email_action_type !== "signup") {
      return new Response(
        JSON.stringify({ message: "Not a signup verification, skipping OTP" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl =
      Deno.env.get("SUPABASE_URL") ?? Deno.env.get("LOCAL_SUPABASE_URL");
    const supabaseServiceRoleKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
      Deno.env.get("LOCAL_SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error("Missing Supabase environment variables");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Generate OTP
    const otp = generateOTP();
    const otpHash = await hashOTP(otp);
    const expiresAt = getOTPExpiry();

    // Store OTP in database
    const { error: insertError } = await supabase
      .from("otp_verifications")
      .insert({
        user_id: user.id,
        email: user.email,
        otp_hash: otpHash,
        otp_type: "signup",
        expires_at: expiresAt.toISOString(),
        request_ip:
          req.headers.get("x-forwarded-for")?.split(",")[0] || "unknown",
      });

    if (insertError) {
      console.error("Failed to store OTP:", insertError);
      throw new Error("Failed to store verification code");
    }

    // Send OTP email
    const html = render(
      React.createElement(EmailOTP, {
        otp,
        email: user.email,
        otpType: "signup",
        expiresInMinutes: 15,
      })
    );

    const FROM_EMAIL =
      Deno.env.get("RESEND_FROM_EMAIL") ||
      "Handicappin' <sebastiansole@handicappin.com>";

    const { error: emailError } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [user.email],
      subject: "Verify Your Email - Handicappin'",
      html,
    });

    if (emailError) {
      throw emailError;
    }

    console.log(`OTP sent successfully to ${user.email}`);
  } catch (error: unknown) {
    let errorMessage = "Unknown error occurred";

    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === "string") {
      errorMessage = error; // If it's a plain string error
    }
    console.log(error);
    return new Response(
      JSON.stringify({
        error: {
          message: errorMessage,
        },
      }),
      {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const responseHeaders = new Headers();
  responseHeaders.set("Content-Type", "application/json");
  return new Response(JSON.stringify({}), {
    status: 200,
    headers: responseHeaders,
  });
});

// To invoke:
// curl -i --location --request POST 'http://localhost:54321/functions/v1/' \
//   --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
//   --header 'Content-Type: application/json' \
//   --data '{"name":"Functions"}'
