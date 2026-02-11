import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { createServerComponentClient } from "@/utils/supabase/server";
import { db } from "@/db";
import { legalConsents } from "@/db/schema";

const requestSchema = z.object({
  legalVersion: z.string().min(1),
  acceptanceMethod: z.enum(["signup", "google_oauth", "re_consent"]),
});

/**
 * Records legal consent (TOS + Privacy Policy) for the authenticated user.
 * Captures IP address server-side from request headers.
 * Inserts two rows into legal_consents: one for terms_of_service, one for privacy_policy.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerComponentClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = requestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { legalVersion, acceptanceMethod } = parsed.data;

    const ipAddress =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ??
      null;

    const now = new Date();

    await db.insert(legalConsents).values([
      {
        userId: user.id,
        consentType: "terms_of_service",
        legalVersion,
        acceptedAt: now,
        ipAddress,
        acceptanceMethod,
      },
      {
        userId: user.id,
        consentType: "privacy_policy",
        legalVersion,
        acceptedAt: now,
        ipAddress,
        acceptanceMethod,
      },
    ]);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
