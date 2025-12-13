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
        { status: 500, headers: corsHeaders }
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
        { status: 500, headers: corsHeaders }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Parse request body
    const { token } = await req.json();

    if (!token) {
      return new Response(JSON.stringify({ error: "Token is required" }), {
        status: 400,
        headers: corsHeaders,
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
        headers: corsHeaders,
      });
    }

    const { user_id } = parsed.data;

    // Hash token to look up the specific pending request
    const tokenHashBuffer = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(token)
    );
    const tokenHash = Array.from(new Uint8Array(tokenHashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    // Look up pending change by token_hash (not user_id)
    // This ensures we only cancel the SPECIFIC request tied to this token
    const { data: pendingChange, error: lookupError } = await supabaseAdmin
      .from("pending_email_changes")
      .select("*")
      .eq("token_hash", tokenHash)
      .single();

    if (lookupError || !pendingChange) {
      return new Response(
        JSON.stringify({ error: "No pending email change found for this token" }),
        { status: 404, headers: corsHeaders }
      );
    }

    // Verify user_id matches (security check)
    if (pendingChange.user_id !== user_id) {
      console.error("User ID mismatch in cancel request", {
        tokenUserId: user_id,
        pendingUserId: pendingChange.user_id,
      });
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: corsHeaders }
      );
    }

    // Delete the specific pending change by token_hash
    const { error: deleteError } = await supabaseAdmin
      .from("pending_email_changes")
      .delete()
      .eq("token_hash", tokenHash);

    if (deleteError) {
      console.error("Failed to cancel email change:", deleteError);
      return new Response(
        JSON.stringify({ error: "Failed to cancel email change" }),
        { status: 500, headers: corsHeaders }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Email change cancelled successfully.",
        user_id: user_id,
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error("Error in cancel-email-change:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: corsHeaders }
    );
  }
});
