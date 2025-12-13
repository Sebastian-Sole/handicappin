import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { create, getNumericDate } from "https://deno.land/x/djwt@v3.0.2/mod.ts";
import { corsHeaders } from "../_shared/cors.ts";

const JWT_SECRET = Deno.env.get("EMAIL_CHANGE_TOKEN_SECRET")!;
const RATE_LIMIT_WINDOW = 3600; // 1 hour in seconds

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
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
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
        const remainingMinutes = Math.ceil(remainingSeconds / 60);

        return new Response(
          JSON.stringify({
            error: `Too many requests. Please try again in ${remainingMinutes} minute${
              remainingMinutes !== 1 ? "s" : ""
            }.`,
          }),
          { status: 429, headers: corsHeaders }
        );
      }
    }

    // Check if new email is already in use by another user in auth.users
    const { data: existingAuthUser, error: authCheckError } = await supabaseAdmin.auth.admin
      .listUsers();

    if (!authCheckError && existingAuthUser?.users) {
      const emailInUse = existingAuthUser.users.some(
        (u) => u.email?.toLowerCase() === newEmail.toLowerCase() && u.id !== user.id
      );

      if (emailInUse) {
        // Generic error to prevent email enumeration
        return new Response(
          JSON.stringify({ error: "This email address cannot be used" }),
          { status: 400, headers: corsHeaders }
        );
      }
    }

    // Generate signed JWT token
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(JWT_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign", "verify"]
    );

    if (!user.email) {
      return new Response(
        JSON.stringify({ error: "User does not have an email address" }),
        { status: 400, headers: corsHeaders }
      );
    }

    const payload = {
      user_id: user.id,
      old_email: user.email,
      new_email: newEmail,
      exp: getNumericDate(48 * 60 * 60), // 48 hours
      metadata: { type: "email-change-verification" },
    };

    const jwtToken = await create({ alg: "HS256", typ: "JWT" }, payload, key);

    // Hash token for storage
    const tokenHashBuffer = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(jwtToken)
    );
    const tokenHash = Array.from(new Uint8Array(tokenHashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    // Get request IP for audit
    const requestIp =
      req.headers.get("x-forwarded-for")?.split(",")[0] ||
      req.headers.get("x-real-ip") ||
      "unknown";

    // Upsert pending email change (replaces any existing pending change)
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

    const { error: upsertError } = await supabaseAdmin
      .from("pending_email_changes")
      .upsert(
        {
          user_id: user.id,
          old_email: user.email!,
          new_email: newEmail,
          token_hash: tokenHash,
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

    // Send emails (call Next.js API routes to use existing email service)
    // For local development, edge functions run in Docker and need to use host.docker.internal
    const originUrl = req.headers.get("origin") || "https://handicappin.com";

    // Detect if we're running locally by checking Supabase URL env var
    // In local Supabase, the URL is "http://kong:8000" (internal Docker network)
    const isLocalEnv = supabaseUrl?.includes("localhost") ||
                       supabaseUrl?.includes("127.0.0.1") ||
                       supabaseUrl?.includes("kong:8000");

    console.log("[DEBUG] Email API URL detection:", {
      supabaseUrl,
      originUrl,
      isLocalEnv,
    });

    // Use origin for URL construction, but override for local development
    let emailApiBaseUrl: string;
    if (isLocalEnv) {
      // In local development, use host.docker.internal to reach Next.js from Docker
      const localOrigin = originUrl.includes("localhost") || originUrl.includes("127.0.0.1")
        ? originUrl
        : "http://localhost:3000"; // Default local Next.js port
      emailApiBaseUrl = localOrigin
        .replace("localhost", "host.docker.internal")
        .replace("127.0.0.1", "host.docker.internal");

      console.log("[DEBUG] Local env detected:", {
        localOrigin,
        emailApiBaseUrl,
      });
    } else {
      emailApiBaseUrl = originUrl;
      console.log("[DEBUG] Production env detected:", {
        emailApiBaseUrl,
      });
    }

    const emailApiUrl = `${emailApiBaseUrl}/api/email/send-email-change`;
    console.log("[DEBUG] Final email API URL:", emailApiUrl);

    // Only pass the token - API will fetch pending change from database
    const emailResponse = await fetch(emailApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader, // Forward auth
        Origin: originUrl, // Pass origin for URL generation
      },
      body: JSON.stringify({
        token: jwtToken,
      }),
    });

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      console.error("Failed to send emails:", {
        status: emailResponse.status,
        statusText: emailResponse.statusText,
        error: errorText,
        emailApiUrl,
      });

      // Delete the pending change since we couldn't send emails
      await supabaseAdmin
        .from("pending_email_changes")
        .delete()
        .eq("user_id", user.id);

      return new Response(
        JSON.stringify({
          error: "Failed to send verification emails. Please try again.",
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Verification email sent. Please check your new email address.",
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error("Error in request-email-change:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: corsHeaders }
    );
  }
});
