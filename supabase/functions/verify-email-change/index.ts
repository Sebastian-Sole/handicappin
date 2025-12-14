import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { verify } from "https://deno.land/x/djwt@v3.0.2/mod.ts";
import { emailChangeJwtPayloadSchema } from "../types.ts";
import { corsHeaders } from "../_shared/cors.ts";

const JWT_SECRET = Deno.env.get("EMAIL_CHANGE_TOKEN_SECRET");

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
    if (!JWT_SECRET) {
      console.error("Missing EMAIL_CHANGE_TOKEN_SECRET");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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
    const { token } = await req.json();

    if (!token) {
      return new Response(JSON.stringify({ error: "Token is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify JWT signature
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(JWT_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const payload = await verify(token, key);
    const parsed = emailChangeJwtPayloadSchema.safeParse(payload);

    if (!parsed.success) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { user_id, old_email, new_email } = parsed.data;

    // Hash token to look up the specific pending request
    const tokenHashBuffer = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(token)
    );
    const tokenHash = Array.from(new Uint8Array(tokenHashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    // Lookup pending change by token_hash (not user_id)
    // This ensures we only verify the SPECIFIC request tied to this token
    const { data: pendingChange, error: lookupError } = await supabaseAdmin
      .from("pending_email_changes")
      .select("*")
      .eq("token_hash", tokenHash)
      .single();

    if (lookupError || !pendingChange) {
      return new Response(
        JSON.stringify({ error: "No pending email change found for this token" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify user_id matches (security check)
    if (pendingChange.user_id !== user_id) {
      console.error("User ID mismatch in verification request", {
        tokenUserId: user_id,
        pendingUserId: pendingChange.user_id,
      });
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check expiration
    const now = new Date();
    const expiresAt = new Date(pendingChange.expires_at);

    if (now > expiresAt) {
      // Clean up expired record using token_hash
      await supabaseAdmin
        .from("pending_email_changes")
        .delete()
        .eq("token_hash", tokenHash);

      return new Response(
        JSON.stringify({
          error: "Verification link has expired. Please request a new email change.",
        }),
        { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify emails match
    if (
      pendingChange.old_email !== old_email ||
      pendingChange.new_email !== new_email
    ) {
      return new Response(JSON.stringify({ error: "Token mismatch" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Atomically increment verification attempts and get updated value (rate limiting)
    const { data: updatedChange, error: updateError } = await supabaseAdmin
      .from("pending_email_changes")
      .update({
        verification_attempts: pendingChange.verification_attempts + 1,
      })
      .eq("token_hash", tokenHash)
      .select()
      .single();

    if (updateError || !updatedChange) {
      console.error("Failed to update verification attempts:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to process verification" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check rate limit AFTER incrementing to prevent race conditions and off-by-one errors
    if (updatedChange.verification_attempts > 5) {
      return new Response(
        JSON.stringify({
          error: "Too many verification attempts. Please request a new email change.",
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
          const stripeResponse = await fetch(
            `https://api.stripe.com/v1/customers/${stripeCustomer.stripe_customer_id}`,
            {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${stripeSecretKey}`,
                "Content-Type": "application/x-www-form-urlencoded",
              },
              body: `email=${encodeURIComponent(new_email)}`,
            }
          );

          if (!stripeResponse.ok) {
            const errorText = await stripeResponse.text();
            console.error("Failed to update Stripe customer email:", errorText);
            // Don't fail the entire operation - email was updated in auth.users
          } else {
            console.log("Successfully updated Stripe customer email");
          }
        }
      }
    } catch (stripeError) {
      console.error("Error updating Stripe customer email:", stripeError);
      // Don't fail the entire operation - email was updated in auth.users
    }

    // Delete pending change record (success!) using token_hash
    await supabaseAdmin
      .from("pending_email_changes")
      .delete()
      .eq("token_hash", tokenHash);

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
