import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(
      new URL("/profile?error=invalid-cancel-link", request.url)
    );
  }

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const response = await fetch(
      `${supabaseUrl}/functions/v1/cancel-email-change`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      }
    );

    const data = await response.json();

    if (response.ok && data.success) {
      return NextResponse.redirect(
        new URL("/profile?tab=personal&cancelled=true", request.url)
      );
    } else {
      return NextResponse.redirect(
        new URL("/profile?error=cancel-failed", request.url)
      );
    }
  } catch (error) {
    console.error("Cancel email change error:", error);
    return NextResponse.redirect(
      new URL("/profile?error=cancel-failed", request.url)
    );
  }
}
