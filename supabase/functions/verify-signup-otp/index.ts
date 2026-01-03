import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { verifyOTPHash, OTP_MAX_ATTEMPTS } from "../_shared/otp-utils.ts";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 204,
    });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
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

    const { email, otp } = await req.json();

    if (!email || !otp) {
      return new Response(
        JSON.stringify({ error: "Email and OTP are required" }),
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
      .eq("otp_type", "signup")
      .eq("verified", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (fetchError || !otpRecord) {
      return new Response(
        JSON.stringify({
          error: "No pending verification found for this email",
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
      // Invalidate the OTP by marking it as expired
      await supabaseAdmin
        .from("otp_verifications")
        .delete()
        .eq("id", otpRecord.id);

      return new Response(
        JSON.stringify({
          error: "Too many verification attempts. Please request a new code.",
          maxAttemptsReached: true,
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
          remainingAttempts,
          maxAttemptsReached: remainingAttempts === 0,
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // OTP is valid! Mark as verified
    const { error: updateError } = await supabaseAdmin
      .from("otp_verifications")
      .update({
        verified: true,
        verified_at: new Date().toISOString(),
      })
      .eq("id", otpRecord.id);

    if (updateError) {
      console.error("Failed to mark OTP as verified:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to complete verification" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // CRITICAL: Verify email in Supabase Auth
    // This marks the email as confirmed in auth.users table
    if (otpRecord.user_id) {
      const { error: authUpdateError } =
        await supabaseAdmin.auth.admin.updateUserById(otpRecord.user_id, {
          email_confirm: true,
        });

      if (authUpdateError) {
        console.error(
          "Failed to confirm email in Supabase Auth:",
          authUpdateError
        );
        return new Response(
          JSON.stringify({
            error: "Failed to confirm email in authentication system",
          }),
          { status: 500, headers: corsHeaders }
        );
      }

      // Mark user as verified in profile table
      const { error: profileError } = await supabaseAdmin
        .from("profile")
        .update({ verified: true })
        .eq("id", otpRecord.user_id);

      if (profileError) {
        console.error(
          "Failed to mark user as verified in profile table:",
          profileError
        );
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Email verified successfully!",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in verify-signup-otp:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
