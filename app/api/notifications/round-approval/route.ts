import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/utils/supabase/admin";
import { env } from "@/env";
import { logger } from "@/lib/logging";
import { captureSentryError } from "@/lib/sentry-utils";
import {
  sendRoundApprovedEmail,
  sendRoundRejectedEmail,
} from "@/lib/email-service";

const payloadSchema = z.object({
  roundId: z.number().int().positive(),
  userId: z.string().uuid(),
  approvalStatus: z.enum(["approved", "rejected"]),
  previousStatus: z.string().optional(),
});

/**
 * Build the scorecard payload passed to the round-approved email.
 * Returns undefined when hole or score data is missing so the email falls
 * back to its simpler summary layout.
 */
function buildScorecardPayload({
  holes,
  scores,
  tee,
}: {
  holes: { id: number; holeNumber: number; par: number; hcp: number }[];
  scores: { holeId: number; strokes: number }[];
  tee: { outPar: number; inPar: number; totalPar: number } | null;
}):
  | {
      holes: { holeNumber: number; par: number; hcp: number }[];
      scores: number[];
      outPar: number;
      inPar?: number;
      totalPar: number;
    }
  | undefined {
  if (!tee || holes.length === 0 || scores.length === 0) return undefined;

  const scoreByHoleId = new Map<number, number>();
  for (const score of scores) {
    scoreByHoleId.set(score.holeId, score.strokes);
  }

  const orderedHoles = [...holes].sort((a, b) => a.holeNumber - b.holeNumber);
  const orderedScores = orderedHoles.map(
    (hole) => scoreByHoleId.get(hole.id) ?? 0,
  );

  return {
    holes: orderedHoles.map((hole) => ({
      holeNumber: hole.holeNumber,
      par: hole.par,
      hcp: hole.hcp,
    })),
    scores: orderedScores,
    outPar: tee.outPar,
    inPar: orderedHoles.length === 18 ? tee.inPar : undefined,
    totalPar: tee.totalPar,
  };
}

/**
 * Constant-time comparison for bearer tokens to avoid timing attacks.
 */
function bearerMatches(header: string | null, expected: string): boolean {
  if (!header) return false;
  const prefix = "Bearer ";
  if (!header.startsWith(prefix)) return false;

  const provided = header.slice(prefix.length);
  const providedBuf = Buffer.from(provided);
  const expectedBuf = Buffer.from(expected);

  if (providedBuf.length !== expectedBuf.length) return false;
  return timingSafeEqual(providedBuf, expectedBuf);
}

/**
 * Called by the Postgres trigger `notify_round_approval_change` when a round's
 * approvalStatus transitions to 'approved' or 'rejected'. Sends the user an
 * email notification.
 *
 * Auth: shared Supabase service role key, retrieved by the trigger from
 * vault.decrypted_secrets.
 *
 * This endpoint is best-effort. Failures are logged to Sentry but we always
 * return 200 - there is no retry mechanism, and pg_net is fire-and-forget
 * anyway. If an email fails to send the user can still see the status in the
 * app.
 */
export async function POST(request: NextRequest) {
  try {
    // In non-production, allow unauthenticated requests so the local Postgres
    // trigger can invoke this endpoint without managing a bearer secret.
    // The endpoint is on localhost and not publicly reachable in dev.
    const isProduction = env.NODE_ENV === "production";

    if (
      isProduction &&
      !bearerMatches(
        request.headers.get("authorization"),
        env.SUPABASE_SERVICE_ROLE_KEY,
      )
    ) {
      logger.warn(
        "Unauthorized access attempt to round-approval notification",
        {
          ip:
            request.headers.get("x-forwarded-for") ||
            request.headers.get("x-real-ip") ||
            "unknown",
        },
      );
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = payloadSchema.safeParse(body);
    if (!parsed.success) {
      logger.warn("Invalid round-approval notification payload", {
        error: parsed.error.message,
      });
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const { roundId, userId, approvalStatus } = parsed.data;

    const supabase = createAdminClient();

    const { data: round, error: roundError } = await supabase
      .from("round")
      .select(
        "id, userId, teeTime, adjustedGrossScore, scoreDifferential, courseId, teeId",
      )
      .eq("id", roundId)
      .single();

    if (roundError || !round) {
      logger.error("Round not found for approval notification", {
        roundId,
        error: roundError?.message,
      });
      // Return 200 so the trigger doesn't get noisy logs; this is
      // unrecoverable without a retry mechanism anyway.
      return NextResponse.json({ ok: true, skipped: "round_not_found" });
    }

    if (round.userId !== userId) {
      logger.error("round.userId mismatch in approval notification", {
        roundId,
        triggerUserId: userId,
        roundUserId: round.userId,
      });
      return NextResponse.json({ ok: true, skipped: "user_mismatch" });
    }

    const [
      { data: profile },
      { data: course },
      { data: tee },
      { data: holes },
      { data: scores },
    ] = await Promise.all([
      supabase.from("profile").select("email, name").eq("id", userId).single(),
      supabase.from("course").select("name").eq("id", round.courseId).single(),
      supabase
        .from("teeInfo")
        .select("name, outPar, inPar, totalPar")
        .eq("id", round.teeId)
        .single(),
      supabase
        .from("hole")
        .select("id, holeNumber, par, hcp")
        .eq("teeId", round.teeId)
        .order("holeNumber", { ascending: true }),
      supabase.from("score").select("holeId, strokes").eq("roundId", roundId),
    ]);

    if (!profile?.email) {
      logger.error("Profile email not found for approval notification", {
        userId,
        roundId,
      });
      return NextResponse.json({ ok: true, skipped: "no_email" });
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ?? "https://handicappin.com";

    if (approvalStatus === "approved") {
      const scorecard = buildScorecardPayload({
        holes: holes ?? [],
        scores: scores ?? [],
        tee: tee ?? null,
      });

      await sendRoundApprovedEmail({
        to: profile.email,
        name: profile.name,
        courseName: course?.name ?? "your course",
        teeName: tee?.name,
        teePlayedAt: round.teeTime,
        adjustedGrossScore: round.adjustedGrossScore,
        scoreDifferential:
          round.scoreDifferential !== null
            ? Number(round.scoreDifferential)
            : undefined,
        roundsUrl: `${baseUrl}/dashboard/${userId}`,
        scorecard,
      });
    } else {
      await sendRoundRejectedEmail({
        to: profile.email,
        name: profile.name,
        courseName: course?.name ?? "your course",
        teeName: tee?.name,
        teePlayedAt: round.teeTime,
        roundsUrl: `${baseUrl}/rounds/add`,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const errorInstance =
      error instanceof Error ? error : new Error("Unknown error");

    logger.error("Round-approval notification endpoint error", {
      error: errorInstance.message,
      stack: errorInstance.stack,
    });

    captureSentryError(errorInstance, {
      level: "error",
      eventType: "round_approval_notification_failed",
      tags: { endpoint: "round-approval" },
    });

    // Return 200 even on error - trigger is fire-and-forget, no retry benefit.
    return NextResponse.json({ ok: false, error: errorInstance.message });
  }
}
