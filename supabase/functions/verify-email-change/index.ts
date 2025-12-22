import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { verifyOTPHash, OTP_MAX_ATTEMPTS } from "../_shared/otp-utils.ts";

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
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Parse request body
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

    // Lookup pending change by user's current email (old_email)
    // We use old_email because that's the email of the authenticated user
    const { data: pendingChange, error: lookupError } = await supabaseAdmin
      .from("pending_email_changes")
      .select("*")
      .eq("old_email", email)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (lookupError || !pendingChange) {
      return new Response(
        JSON.stringify({
          error: "No pending email change found for this email",
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { user_id, old_email, new_email } = pendingChange;

    // Check expiration
    const now = new Date();
    const expiresAt = new Date(pendingChange.expires_at);

    if (now > expiresAt) {
      // Clean up expired record
      await supabaseAdmin
        .from("pending_email_changes")
        .delete()
        .eq("user_id", user_id);

      return new Response(
        JSON.stringify({
          error:
            "Verification code has expired. Please request a new email change.",
        }),
        {
          status: 410,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check rate limit BEFORE verifying OTP to prevent brute force
    if (pendingChange.verification_attempts >= OTP_MAX_ATTEMPTS) {
      return new Response(
        JSON.stringify({
          error:
            "Too many verification attempts. Please request a new email change.",
        }),
        {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Verify OTP against stored hash
    const isValid = await verifyOTPHash(otp, pendingChange.token_hash);

    if (!isValid) {
      // Increment attempts on failure
      await supabaseAdmin
        .from("pending_email_changes")
        .update({
          verification_attempts: pendingChange.verification_attempts + 1,
        })
        .eq("user_id", user_id);

      const remainingAttempts =
        OTP_MAX_ATTEMPTS - (pendingChange.verification_attempts + 1);

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

    // Update auth.users.email - this is the single source of truth
    const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(
      user_id,
      { email: new_email }
    );

    if (authUpdateError) {
      console.error("Failed to update auth.users email:", authUpdateError);
      return new Response(
        JSON.stringify({
          error: "Failed to update email. Please try again or contact support.",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update Stripe customer email if they have a Stripe customer ID
    try {
      const { data: stripeCustomer } = await supabaseAdmin
        .from("stripe_customers")
        .select("stripe_customer_id")
        .eq("user_id", user_id)
        .single();

      if (stripeCustomer?.stripe_customer_id) {
        const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");

        if (stripeSecretKey) {
          // Add timeout to prevent hanging on slow Stripe responses
          const abortController = new AbortController();
          const timeoutId = setTimeout(() => abortController.abort(), 5000); // 5 second timeout

          try {
            const stripeResponse = await fetch(
              `https://api.stripe.com/v1/customers/${stripeCustomer.stripe_customer_id}`,
              {
                method: "POST",
                headers: {
                  "Authorization": `Bearer ${stripeSecretKey}`,
                  "Content-Type": "application/x-www-form-urlencoded",
                },
                body: `email=${encodeURIComponent(new_email)}`,
                signal: abortController.signal,
              }
            );

            clearTimeout(timeoutId);

            if (!stripeResponse.ok) {
              const requestId = stripeResponse.headers.get("request-id");
              console.error("Failed to update Stripe customer email", {
                status: stripeResponse.status,
                requestId,
              });
              // Don't fail the entire operation - email was updated in auth.users
            } else {
              console.log("Successfully updated Stripe customer email");
            }
          } catch (fetchError) {
            clearTimeout(timeoutId);
            if (fetchError instanceof Error && fetchError.name === "AbortError") {
              console.error("Stripe customer email update timed out after 5s");
            } else {
              throw fetchError; // Re-throw to outer catch
            }
          }
        }
      }
    } catch (stripeError) {
      console.error("Error updating Stripe customer email:", stripeError);
      // Don't fail the entire operation - email was updated in auth.users
    }

    // Delete pending change record (success!)
    await supabaseAdmin
      .from("pending_email_changes")
      .delete()
      .eq("user_id", user_id);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Email address updated successfully!",
        user_id,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in verify-email-change:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
