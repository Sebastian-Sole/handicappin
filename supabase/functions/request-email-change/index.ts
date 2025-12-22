import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { render } from "https://esm.sh/@react-email/components@0.0.22?deps=react@18.2.0";
import * as React from "https://esm.sh/react@18.2.0";
import EmailVerificationChange from "./email-verification-change.tsx";
import EmailChangeNotification from "./email-change-notification.tsx";
import { maskEmail } from "./utils.ts";
import { generateOTP, hashOTP } from "../_shared/otp-utils.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const RATE_LIMIT_WINDOW = 120; // 2 minutes in seconds (allows resending if email delayed)

if (!RESEND_API_KEY) {
  throw new Error("Missing required environment variable: RESEND_API_KEY");
}

const resend = new Resend(RESEND_API_KEY);
const FROM_EMAIL =
  Deno.env.get("RESEND_FROM_EMAIL") ||
  "Handicappin' <sebastiansole@handicappin.com>";

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
      console.error("Missing Supabase environment variables");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: corsHeaders }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Get authenticated user from request
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    // Parse request body
    const { newEmail } = await req.json();

    if (!newEmail || typeof newEmail !== "string") {
      return new Response(JSON.stringify({ error: "New email is required" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    // Validate email format
    const emailRegex =
      /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
    if (!emailRegex.test(newEmail)) {
      return new Response(JSON.stringify({ error: "Invalid email format" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    // Check if new email is same as current
    if (newEmail.toLowerCase() === user.email?.toLowerCase()) {
      return new Response(
        JSON.stringify({ error: "New email must be different from current" }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Check rate limiting - only 1 request per hour
    const { data: existingPending } = await supabaseAdmin
      .from("pending_email_changes")
      .select("created_at")
      .eq("user_id", user.id)
      .single();

    if (existingPending) {
      const createdAt = new Date(existingPending.created_at);
      const now = new Date();
      const secondsSinceLastRequest =
        (now.getTime() - createdAt.getTime()) / 1000;

      if (secondsSinceLastRequest < RATE_LIMIT_WINDOW) {
        const remainingSeconds = Math.ceil(
          RATE_LIMIT_WINDOW - secondsSinceLastRequest
        );

        return new Response(
          JSON.stringify({
            error: `Too many requests. Please try again in ${remainingSeconds} second${
              remainingSeconds !== 1 ? "s" : ""
            }.`,
          }),
          { status: 429, headers: corsHeaders }
        );
      }
    }

    if (!user.email) {
      return new Response(
        JSON.stringify({ error: "User does not have an email address" }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Generate OTP
    const otp = generateOTP();
    const otpHash = await hashOTP(otp);
    // Email change needs longer expiry (48 hours) because user must check NEW email
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours

    // Generate secure random cancel token (32 bytes = 64 hex characters)
    const cancelTokenBytes = new Uint8Array(32);
    crypto.getRandomValues(cancelTokenBytes);
    const cancelToken = Array.from(cancelTokenBytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    console.log("[DEBUG] Generated OTP:", {
      otp, // In production, remove this!
      otpHash: otpHash.substring(0, 10) + "...",
      expiresAt: expiresAt.toISOString(),
      expiresAtTime: expiresAt.getTime(),
      now: new Date().toISOString(),
      nowTime: Date.now(),
    });

    // Get request IP for audit
    const requestIp =
      req.headers.get("x-forwarded-for")?.split(",")[0] ||
      req.headers.get("x-real-ip") ||
      "unknown";

    // Upsert pending email change (replaces any existing pending change)
    const { error: upsertError } = await supabaseAdmin
      .from("pending_email_changes")
      .upsert(
        {
          user_id: user.id,
          old_email: user.email!,
          new_email: newEmail,
          token_hash: otpHash, // Store OTP hash
          cancel_token: cancelToken, // Store cancel token
          expires_at: expiresAt.toISOString(),
          request_ip: requestIp,
          verification_attempts: 0,
        },
        { onConflict: "user_id" }
      );

    if (upsertError) {
      console.error("Error creating pending email change:", upsertError);
      return new Response(
        JSON.stringify({ error: "Failed to process request" }),
        { status: 500, headers: corsHeaders }
      );
    }

    console.log("[DEBUG] OTP stored successfully for user:", user.id);

    // Generate URLs for emails
    const originUrl = req.headers.get("origin") || "https://handicappin.com";

    const cancelUrlObj = new URL("/api/auth/cancel-email-change", originUrl);
    // Use cancel_token for secure cancellation from old email
    cancelUrlObj.searchParams.set("token", cancelToken);
    const cancelUrl = cancelUrlObj.toString();

    console.log("[DEBUG] Sending emails:", {
      newEmail: maskEmail(newEmail),
      oldEmail: maskEmail(user.email!),
      otpGenerated: "yes", // Don't log the actual OTP
    });

    // Send verification email to NEW email address with OTP
    try {
      const verificationHtml = render(
        React.createElement(EmailVerificationChange, {
          otp,
          oldEmail: user.email!,
          newEmail,
          expiresInHours: 48,
        })
      );

      const verificationResult = await resend.emails.send({
        from: FROM_EMAIL,
        to: newEmail,
        subject: "Verify your new email address",
        html: verificationHtml,
      });

      if (verificationResult.error) {
        throw new Error(
          `Verification email failed: ${verificationResult.error.message}`
        );
      }

      console.log("[INFO] Verification email sent:", {
        messageId: verificationResult.data?.id,
        to: maskEmail(newEmail),
      });
    } catch (error) {
      console.error("Failed to send verification email:", error);

      // Delete the pending change since we couldn't send emails
      await supabaseAdmin
        .from("pending_email_changes")
        .delete()
        .eq("user_id", user.id);

      return new Response(
        JSON.stringify({
          error: "Failed to send verification email. Please try again.",
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    // Send notification email to OLD email address
    try {
      const notificationHtml = render(
        React.createElement(EmailChangeNotification, {
          cancelUrl,
          newEmail: maskEmail(newEmail),
          oldEmail: user.email!,
        })
      );

      const notificationResult = await resend.emails.send({
        from: FROM_EMAIL,
        to: user.email!,
        subject: "Email change requested for your account",
        html: notificationHtml,
      });

      if (notificationResult.error) {
        throw new Error(
          `Notification email failed: ${notificationResult.error.message}`
        );
      }

      console.log("[INFO] Notification email sent:", {
        messageId: notificationResult.data?.id,
        to: maskEmail(user.email),
      });
    } catch (error) {
      console.error("Failed to send notification email:", error);

      // Don't delete pending change - verification email was sent successfully
      // User can still verify, but won't have cancel link
      console.warn(
        "[WARN] Notification email failed but verification email sent"
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message:
          "Verification email sent. Please check your new email address.",
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error("Error in request-email-change:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
