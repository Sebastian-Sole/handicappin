import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  sendEmailChangeVerification,
  sendEmailChangeNotification,
} from "@/lib/email-service";

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
      console.error("Auth error:", authError);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { verificationEmail, notificationEmail } = body;

    // Send both emails in parallel
    const [verificationResult, notificationResult] = await Promise.all([
      sendEmailChangeVerification(verificationEmail),
      sendEmailChangeNotification(notificationEmail),
    ]);

    // Check results
    if (!verificationResult.success || !notificationResult.success) {
      console.error("Email sending failed:", {
        verification: verificationResult,
        notification: notificationResult,
      });

      return NextResponse.json(
        {
          error: "Failed to send emails",
          details: {
            verification: verificationResult.error,
            notification: notificationResult.error,
          },
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      messageIds: {
        verification: verificationResult.messageId,
        notification: notificationResult.messageId,
      },
    });
  } catch (error) {
    console.error("Error in send-email-change API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
