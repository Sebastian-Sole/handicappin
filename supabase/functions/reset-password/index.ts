import { createClient } from "jsr:@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@4.0.0";
import ResetPasswordEmail from "./email.tsx";
import { render } from "https://esm.sh/@react-email/components@0.0.22?deps=react@18.2.0";
import { corsHeaders } from "../_shared/cors.ts";
import { generateOTP, hashOTP, getOTPExpiry } from "../_shared/otp-utils.ts";
import * as React from "https://esm.sh/react@18.2.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY")!);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", {
      status: 405,
      headers: corsHeaders,
    });
  }

  console.log("Reset password request");

  const supabaseUrl =
    Deno.env.get("SUPABASE_URL") ?? Deno.env.get("LOCAL_SUPABASE_URL");
  const supabaseServiceRoleKey =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
    Deno.env.get("LOCAL_SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.error("Missing Supabase environment variables");
    return new Response(
      JSON.stringify({ error: "Missing Supabase environment variables" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

  try {
    const { email } = await req.json();
    console.log("Email:", email);
    if (!email) throw new Error("Email is required");

    // Find user by email using profile table (O(1) with index)
    const { data: profile, error: profileError } = await supabase
      .from("profile")
      .select("id, email")
      .eq("email", email.toLowerCase())
      .single();

    if (profileError || !profile) {
      console.error("User not found for email:", email);
      throw new Error("User not found");
    }

    // Get auth user (optional - could skip if we only need the ID)
    const { data: { user }, error } = await supabase.auth.admin.getUserById(profile.id);

    if (error || !user) {
      console.error("Failed to get user:", error);
      throw new Error("User not found");
    }

    // Generate OTP
    const otp = generateOTP();
    const otpHash = await hashOTP(otp);
    const expiresAt = getOTPExpiry(); // 15 minutes

    // Get request IP for audit
    const requestIp =
      req.headers.get("x-forwarded-for")?.split(",")[0] ||
      req.headers.get("x-real-ip") ||
      "unknown";

    // Store OTP in database
    const { error: insertError } = await supabase
      .from("otp_verifications")
      .insert({
        user_id: user.id,
        email: email,
        otp_hash: otpHash,
        otp_type: "password_reset",
        expires_at: expiresAt.toISOString(),
        request_ip: requestIp,
      });

    if (insertError) {
      console.error("Failed to store OTP:", insertError);
      throw new Error("Failed to store verification code");
    }

    // Send OTP email
    const emailHtml = render(
      React.createElement(ResetPasswordEmail, {
        otp,
        username: email,
        expiresInMinutes: 15,
      })
    );

    const FROM_EMAIL =
      Deno.env.get("RESEND_FROM_EMAIL") ||
      "Handicappin' <sebastiansole@handicappin.com>";

    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: "Reset Password Request",
      html: emailHtml,
    });

    return new Response("Password reset email sent", {
      status: 200,
      headers: corsHeaders,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error }), {
      status: 400,
      headers: corsHeaders,
    });
  }
});
