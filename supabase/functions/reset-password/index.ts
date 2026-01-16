import { createClient } from "jsr:@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@4.0.0";
import ResetPasswordEmail from "./email.tsx";
import { render } from "https://esm.sh/@react-email/components@0.0.22?deps=react@18.2.0";
import { corsHeaders } from "../_shared/cors.ts";
import { generateOTP, hashOTP, getOTPExpiry } from "../_shared/otp-utils.ts";
import { validateEmail } from "../_shared/validation.ts";
import * as React from "https://esm.sh/react@18.2.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY")!);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
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
    console.log("Reset password request for email:", email);

    // Validate email format early
    if (!email) {
      throw new Error("Email is required");
    }

    const emailError = validateEmail(email);
    if (emailError) {
      return new Response(
        JSON.stringify({ error: emailError }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Normalize email (lowercase + trim) for consistent lookups and storage
    const normalizedEmail = email.toLowerCase().trim();

    // Find user by email using profile table (O(1) with index)
    const { data: profile, error: profileError } = await supabase
      .from("profile")
      .select("id, email")
      .eq("email", normalizedEmail)
      .single();

    // Security: Don't leak whether email exists or not
    // Always return success to prevent account enumeration
    if (profileError || !profile) {
      console.log("User not found for email (silently skipping):", email);
      // Return success without sending email
      return new Response(
        JSON.stringify({
          success: true,
          message: "If an account exists, a reset code has been sent"
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get auth user (optional - could skip if we only need the ID)
    const { data: { user }, error } = await supabase.auth.admin.getUserById(profile.id);

    if (error || !user) {
      console.error("Failed to get user from auth:", error);
      // Return success to prevent account enumeration
      return new Response(
        JSON.stringify({
          success: true,
          message: "If an account exists, a reset code has been sent"
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
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

    // Store OTP in database with normalized email for consistent lookups
    const { error: insertError } = await supabase
      .from("otp_verifications")
      .insert({
        user_id: user.id,
        email: normalizedEmail,
        otp_hash: otpHash,
        otp_type: "password_reset",
        expires_at: expiresAt.toISOString(),
        request_ip: requestIp,
      });

    if (insertError) {
      console.error("Failed to store OTP:", insertError);
      throw new Error("Failed to store verification code");
    }

    // Send OTP email using normalized email
    const emailHtml = render(
      React.createElement(ResetPasswordEmail, {
        otp,
        username: normalizedEmail,
        expiresInMinutes: 15,
      })
    );

    const FROM_EMAIL =
      Deno.env.get("RESEND_FROM_EMAIL") ||
      "Handicappin' <sebastiansole@handicappin.com>";

    await resend.emails.send({
      from: FROM_EMAIL,
      to: normalizedEmail,
      subject: "Reset Password Request",
      html: emailHtml,
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: "Password reset code sent"
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Reset password error:", error);
    // Return generic error without details to prevent information leakage
    return new Response(
      JSON.stringify({
        error: "Unable to process password reset request. Please try again."
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
