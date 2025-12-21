import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";
import * as React from "https://esm.sh/react@18.2.0";
import { render } from "https://esm.sh/@react-email/components@0.0.22?deps=react@18.2.0";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { generateOTP, hashOTP, getOTPExpiry } from "../_shared/otp-utils.ts";
import EmailOTP from "../send-verification-email/email-otp.tsx";

console.log("resend-verification-otp function");

const resend = new Resend(Deno.env.get("RESEND_API_KEY") as string);

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const { email } = await req.json();

    if (!email || typeof email !== "string") {
      return new Response(
        JSON.stringify({ error: "Email is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
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

    // Check if user exists and is unconfirmed
    const { data: userData, error: userError } = await supabase.auth.admin.listUsers();

    if (userError) {
      console.error("Error fetching users:", userError);
      // Don't reveal if email exists or not
      return new Response(
        JSON.stringify({
          success: true,
          message: "If an account exists with this email, a new code has been sent."
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    const user = userData.users.find(u => u.email === email);

    if (!user) {
      // Don't reveal if email exists or not
      return new Response(
        JSON.stringify({
          success: true,
          message: "If an account exists with this email, a new code has been sent."
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // Check if user is already confirmed
    if (user.email_confirmed_at) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Email is already verified. Please login."
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Rate limiting: Check for recent OTP requests
    // Allow first resend immediately, but rate limit subsequent resends (60 seconds)
    const { data: allOTPs } = await supabase
      .from("otp_verifications")
      .select("created_at")
      .eq("user_id", user.id)
      .eq("otp_type", "signup")
      .order("created_at", { ascending: false });

    // If there are 2 or more OTPs (original + at least 1 resend), check rate limit
    if (allOTPs && allOTPs.length >= 2) {
      const lastOTP = allOTPs[0];
      const lastOTPTime = new Date(lastOTP.created_at).getTime();
      const now = Date.now();
      const timeSinceLastOTP = now - lastOTPTime;
      const RATE_LIMIT_MS = 60 * 1000; // 60 seconds

      if (timeSinceLastOTP < RATE_LIMIT_MS) {
        const waitSeconds = Math.ceil((RATE_LIMIT_MS - timeSinceLastOTP) / 1000);
        return new Response(
          JSON.stringify({
            success: false,
            error: `Please wait ${waitSeconds} seconds before requesting another code.`,
            waitSeconds
          }),
          { status: 429, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // Generate new OTP
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
        request_ip: req.headers.get("x-forwarded-for")?.split(",")[0] || "unknown",
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
      console.error("Failed to send email:", emailError);
      throw new Error("Failed to send verification email");
    }

    console.log(`Resent OTP successfully to ${user.email}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "A new verification code has been sent to your email."
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    let errorMessage = "An unexpected error occurred";

    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === "string") {
      errorMessage = error;
    }

    console.error("Resend OTP error:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});
