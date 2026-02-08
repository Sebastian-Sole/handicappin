import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

const requestSchema = z.object({
  code: z.string().min(1),
});

/**
 * Exchanges a Google OAuth authorization code for an ID token.
 * Used by the client-side Google sign-in button (useGoogleLogin auth-code flow)
 * to obtain an id_token for Supabase's signInWithIdToken.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = requestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request" },
        { status: 400 }
      );
    }

    const { code } = parsed.data;

    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return NextResponse.json(
        { error: "Google OAuth not configured" },
        { status: 500 }
      );
    }

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: "postmessage",
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      return NextResponse.json(
        { error: "Failed to exchange code" },
        { status: 502 }
      );
    }

    const tokens = await tokenResponse.json();

    if (!tokens.id_token) {
      return NextResponse.json(
        { error: "No ID token in response" },
        { status: 502 }
      );
    }

    return NextResponse.json({ id_token: tokens.id_token });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
