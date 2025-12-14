import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  sendEmailChangeVerification,
  sendEmailChangeNotification,
} from "@/lib/email-service";
import { z } from "zod";
import { redactEmail } from "@/lib/logging";

// URL allowlist for validation
const ALLOWED_ORIGINS = [
  process.env.NEXT_PUBLIC_APP_URL || "https://handicappin.com",
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  // Allow localhost variations for local development only
  ...(process.env.NODE_ENV === "development"
    ? ["http://localhost:3000", "http://127.0.0.1:3000"]
    : []),
].filter(Boolean);

// Validate configuration
if (ALLOWED_ORIGINS.length === 0) {
  throw new Error("ALLOWED_ORIGINS must contain at least one valid origin");
}

// In production, warn if localhost is still present
if (process.env.NODE_ENV === "production") {
  const hasLocalhost = ALLOWED_ORIGINS.some(origin =>
    origin.includes("localhost") || origin.includes("127.0.0.1")
  );
  if (hasLocalhost) {
    console.warn("Warning: localhost origins present in production ALLOWED_ORIGINS");
  }
}

const bodySchema = z.object({
  token: z.string(), // JWT token for URL generation
});

export async function POST(request: Request) {
  try {
    // Get the authorization token from the header
    const authHeader = request.headers.get("Authorization");

    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Validate required environment variables
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error("Missing Supabase configuration:", {
        hasUrl: !!supabaseUrl,
        hasAnonKey: !!supabaseAnonKey,
      });
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    // Create a Supabase client with the user's token
    const supabase = createClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        global: {
          headers: {
            Authorization: authHeader,
          },
        },
      }
    );

    // Verify user is authenticated
    // getUser() will use the Authorization header we set above
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error("Auth error in send-email-change:", {
        error: authError?.message,
        status: authError?.status,
      });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { token } = parsed.data;

    // Fetch pending email change from database - DO NOT trust client-provided data
    const { data: pendingChange, error: fetchError } = await supabase
      .from("pending_email_changes")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (fetchError || !pendingChange) {
      console.error("No pending email change found for user:", {
        userId: user.id,
        error: fetchError?.message,
      });
      return NextResponse.json(
        { error: "No pending email change request found" },
        { status: 404 }
      );
    }

    // Check if expired
    if (new Date(pendingChange.expires_at) < new Date()) {
      return NextResponse.json(
        { error: "Email change request has expired" },
        { status: 410 }
      );
    }

    // Use database values (never trust client input)
    const newEmail = pendingChange.new_email;
    const oldEmail = pendingChange.old_email;

    // Generate URLs server-side
    const origin = request.headers.get("origin") || process.env.NEXT_PUBLIC_APP_URL || "https://handicappin.com";

    // Validate origin against allowlist
    let originUrl: URL;
    try {
      originUrl = new URL(origin);
    } catch (error) {
      console.error("Invalid origin URL:", {
        origin,
        error: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json(
        { error: "Invalid origin" },
        { status: 400 }
      );
    }

    const isAllowedOrigin = ALLOWED_ORIGINS.some(allowed => {
      if (!allowed) return false;
      try {
        const allowedUrl = new URL(allowed);
        return allowedUrl.host === originUrl.host;
      } catch {
        return false;
      }
    });

    if (!isAllowedOrigin) {
      console.error("Unauthorized origin for email change:", {
        origin,
        originHost: originUrl.host,
        allowedOrigins: ALLOWED_ORIGINS,
      });
      return NextResponse.json(
        { error: "Unauthorized origin" },
        { status: 403 }
      );
    }

    // Generate verification and cancel URLs with the token
    const verificationUrl = `${origin}/verify-email-change?token=${token}`;
    const cancelUrl = `${origin}/api/auth/cancel-email-change?token=${token}`;

    // Send both emails in parallel
    const [verificationResult, notificationResult] = await Promise.all([
      sendEmailChangeVerification({
        to: newEmail,
        verificationUrl,
        oldEmail,
        newEmail,
      }),
      sendEmailChangeNotification({
        to: oldEmail,
        cancelUrl,
        newEmail,
      }),
    ]);

    // Check results
    if (!verificationResult.success || !notificationResult.success) {
      console.error("Email sending failed:", {
        userId: user.id,
        oldEmail: redactEmail(oldEmail),
        newEmail: redactEmail(newEmail),
        verificationSuccess: verificationResult.success,
        notificationSuccess: notificationResult.success,
        // Only log that an error occurred, not the error details
        hasVerificationError: !!verificationResult.error,
        hasNotificationError: !!notificationResult.error,
      });

      return NextResponse.json(
        { error: "Failed to send emails" },
        { status: 500 }
      );
    }

    // Log success with redacted emails for audit trail
    console.log("Email change emails sent successfully:", {
      userId: user.id,
      oldEmail: redactEmail(oldEmail),
      newEmail: redactEmail(newEmail),
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("Error in send-email-change API:", {
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
