import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(
      new URL("/login?error=invalid-cancel-link", request.url)
    );
  }

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) {
      return NextResponse.redirect(
        new URL("/login?error=cancel-failed", request.url)
      );
    }

    const response = await fetch(
      `${supabaseUrl}/functions/v1/cancel-email-change`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      }
    );

    const data = await response.json();

    if (response.ok && data.success && data.user_id) {
      // Use the user_id from the token to redirect to their profile
      return NextResponse.redirect(
        new URL(`/profile/${data.user_id}?tab=personal&cancelled=true`, request.url)
      );
    } else {
      return NextResponse.redirect(
        new URL("/login?error=cancel-failed", request.url)
      );
    }
  } catch (error) {
    console.error("Cancel email change error:", error);
    return NextResponse.redirect(
      new URL("/login?error=cancel-failed", request.url)
    );
  }
}
