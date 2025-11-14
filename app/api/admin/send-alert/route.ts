import { NextRequest, NextResponse } from "next/server";

/**
 * Simple email alert endpoint
 * TODO: Implement with your email provider (Resend, SendGrid, etc.)
 */
export async function POST(request: NextRequest) {
  try {
    const { to, subject, body } = await request.json();

    // For now, just log to console
    // TODO: Implement with Resend/SendGrid when ready
    console.log("📧 Email Alert:");
    console.log("To:", to);
    console.log("Subject:", subject);
    console.log("Body:", body);

    // Return success
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error sending email alert:", error);
    return NextResponse.json(
      { error: "Failed to send email" },
      { status: 500 }
    );
  }
}
