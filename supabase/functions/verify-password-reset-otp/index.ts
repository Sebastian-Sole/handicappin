import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { verifyOTPHash, OTP_MAX_ATTEMPTS } from "../_shared/otp-utils.ts";
import { corsHeaders } from "../_shared/cors.ts";

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

  try {
    const supabaseUrl =
      Deno.env.get("SUPABASE_URL") ?? Deno.env.get("LOCAL_SUPABASE_URL");
    const supabaseServiceRoleKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
      Deno.env.get("LOCAL_SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

    const { email, otp, newPassword } = await req.json();

    if (!email || !otp || !newPassword) {
      return new Response(
        JSON.stringify({
          error: "Email, OTP, and new password are required",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validate password strength
    if (newPassword.length < 8) {
      return new Response(
        JSON.stringify({
          error: "Password must be at least 8 characters long",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Find the most recent unverified OTP for this email
    const { data: otpRecord, error: fetchError } = await supabaseAdmin
      .from("otp_verifications")
      .select("*")
      .eq("email", email)
      .eq("otp_type", "password_reset")
      .eq("verified", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (fetchError || !otpRecord) {
      return new Response(
        JSON.stringify({
          error: "No pending password reset found for this email",
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check expiration
    const now = new Date();
    const expiresAt = new Date(otpRecord.expires_at);

    if (now > expiresAt) {
      // Delete expired OTP
      await supabaseAdmin
        .from("otp_verifications")
        .delete()
        .eq("id", otpRecord.id);

      return new Response(
        JSON.stringify({
          error: "Verification code has expired. Please request a new one.",
        }),
        {
          status: 410,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check attempt limit
    if (otpRecord.verification_attempts >= OTP_MAX_ATTEMPTS) {
      return new Response(
        JSON.stringify({
          error: "Too many verification attempts. Please request a new code.",
        }),
        {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Verify OTP
    const isValid = await verifyOTPHash(otp, otpRecord.otp_hash);

    if (!isValid) {
      // Increment attempts
      await supabaseAdmin
        .from("otp_verifications")
        .update({
          verification_attempts: otpRecord.verification_attempts + 1,
        })
        .eq("id", otpRecord.id);

      const remainingAttempts =
        OTP_MAX_ATTEMPTS - (otpRecord.verification_attempts + 1);

      return new Response(
        JSON.stringify({
          error: `Invalid verification code. ${remainingAttempts} attempt${
            remainingAttempts !== 1 ? "s" : ""
          } remaining.`,
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // OTP is valid! Reset the password
    const { error: updateError } =
      await supabaseAdmin.auth.admin.updateUserById(otpRecord.user_id, {
        password: newPassword,
      });

    if (updateError) {
      console.error("Failed to reset password:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to reset password" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Mark OTP as verified and delete it
    await supabaseAdmin
      .from("otp_verifications")
      .delete()
      .eq("id", otpRecord.id);

    console.log(`Password reset successfully for ${email}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Password reset successfully!",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in verify-password-reset-otp:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
