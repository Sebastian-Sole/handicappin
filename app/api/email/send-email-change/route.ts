import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  sendEmailChangeVerification,
  sendEmailChangeNotification,
} from "@/lib/email-service";
import { z } from "zod";
import { redactEmail } from "@/lib/logging";

const bodySchema = z.object({
  newEmail: z.string().email(),
  verificationUrl: z.string().url(),
  cancelUrl: z.string().url(),
});

export async function POST(request: Request) {
  try {
    // Get the authorization token from the header
    const authHeader = request.headers.get("Authorization");

    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Create a Supabase client with the user's token
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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

    const { newEmail, verificationUrl, cancelUrl } = parsed.data;
    const oldEmail = user.email;
    if (!oldEmail) {
      return NextResponse.json(
        { error: "User email not available" },
        { status: 400 }
      );
    }

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
