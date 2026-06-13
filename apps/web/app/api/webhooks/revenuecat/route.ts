/**
 * RevenueCat webhook — Apple billing events into the SAME entitlement
 * projection the Stripe webhook feeds (handoff DoD #3).
 *
 * Mirrors apps/web/app/api/stripe/webhook/route.ts in structure and
 * security posture: rate limit → auth → trust-boundary parse →
 * idempotency (webhook_events) → per-provider out-of-order guard →
 * applyBillingEvent (THE merge chokepoint) → projection write with
 * billing_version bump → success/failure recording + admin alerts.
 *
 * Auth: RevenueCat sends a configured value in the Authorization header on
 * every request. Compared timing-safe against REVENUECAT_WEBHOOK_AUTH_TOKEN;
 * absent config fails closed in production and open (with a warning) in dev.
 */
import { createHash, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { profile, webhookEvents } from "@/db/schema";
import { env } from "@/env";
import { sendDoubleContractAlert, sendTransferAlert } from "@/lib/admin-alerts";
import { webhookRateLimit, getIdentifier } from "@/lib/rate-limit";
import { mapRevenueCatEvent } from "@/lib/revenuecat/map-event";
import { rcWebhookPayloadSchema, type RcEvent } from "@/lib/revenuecat/schema";
import {
  logWebhookReceived,
  logWebhookSuccess,
  logWebhookError,
  logWebhookInfo,
  logWebhookWarning,
} from "@/lib/webhook-logger";
import { logger } from "@/lib/logging";
import {
  applyBillingEvent,
  type BillingProjection,
  type CurrentBillingState,
} from "@/utils/billing/apply-billing-event";

const PROVIDER = "apple" as const;

function timingSafeStringEqual(a: string, b: string): boolean {
  // Hash both sides so length differences don't leak through timingSafeEqual.
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

/**
 * 200-with-context for events we acknowledge without projecting. RevenueCat
 * retries any non-200 up to 5 times — "not relevant to us" must be a 200.
 */
function acknowledged(body: Record<string, unknown>): NextResponse {
  return NextResponse.json({ received: true, ...body }, { status: 200 });
}

async function recordEvent(params: {
  event: RcEvent;
  userId: string | null;
  /** Advances the ordering cursor — only for EVALUATED entitlement events. */
  advanceCursor: boolean;
  note?: string;
}): Promise<void> {
  try {
    await db
      .insert(webhookEvents)
      .values({
        eventId: params.event.id,
        eventType: `revenuecat.${params.event.type}`,
        status: "success",
        userId: params.userId,
        provider: PROVIDER,
        eventTimeMs: params.advanceCursor
          ? params.event.event_timestamp_ms
          : null,
        errorMessage: params.note ?? null,
      })
      .onConflictDoNothing();
  } catch (recordError) {
    // Mirror the Stripe route: recording failure must not fail the webhook.
    logWebhookError(
      "Failed to record RevenueCat webhook event (event was processed)",
      recordError,
    );
  }
}

async function recordFailure(event: RcEvent, userId: string | null, message: string): Promise<void> {
  try {
    const existing = await db
      .select()
      .from(webhookEvents)
      .where(eq(webhookEvents.eventId, event.id))
      .limit(1);
    const retryCount = existing.length > 0 ? (existing[0].retryCount || 0) + 1 : 1;
    await db
      .insert(webhookEvents)
      .values({
        eventId: event.id,
        eventType: `revenuecat.${event.type}`,
        status: "failed",
        errorMessage: message,
        retryCount,
        userId,
        provider: PROVIDER,
        eventTimeMs: null,
      })
      .onConflictDoUpdate({
        target: webhookEvents.eventId,
        set: {
          retryCount: sql`${webhookEvents.retryCount} + 1`,
          errorMessage: message,
          processedAt: sql`CURRENT_TIMESTAMP`,
        },
      });
  } catch (recordError) {
    logWebhookError("Failed to record RevenueCat webhook failure", recordError);
  }
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  let event: RcEvent | null = null;
  let userId: string | null = null;

  try {
    // Rate limiting (IP-based, same limiter as the Stripe webhook).
    const identifier = getIdentifier(request);
    const { success, reset } = await webhookRateLimit.limit(identifier);
    if (!success) {
      const retryAfterSeconds = Math.ceil((reset - Date.now()) / 1000);
      logger.warn(`[Rate Limit] RevenueCat webhook rate limited for ${identifier}`);
      return NextResponse.json(
        { error: "Rate limit exceeded", retryAfter: retryAfterSeconds },
        { status: 429, headers: { "Retry-After": retryAfterSeconds.toString() } },
      );
    }

    // Shared-secret Authorization header check.
    const configuredToken = env.REVENUECAT_WEBHOOK_AUTH_TOKEN;
    const authHeader = request.headers.get("authorization");
    if (configuredToken) {
      if (!authHeader || !timingSafeStringEqual(authHeader, configuredToken)) {
        logWebhookWarning("RevenueCat webhook rejected: bad Authorization header");
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    } else if (env.NODE_ENV === "production") {
      // Fail closed: an unauthenticated billing webhook must not run in prod.
      logWebhookError(
        "REVENUECAT_WEBHOOK_AUTH_TOKEN is not configured in production - rejecting",
      );
      return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
    } else {
      logWebhookWarning(
        "RevenueCat webhook auth SKIPPED (REVENUECAT_WEBHOOK_AUTH_TOKEN unset, non-production)",
      );
    }

    // Trust-boundary parse.
    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const parsed = rcWebhookPayloadSchema.safeParse(rawBody);
    if (!parsed.success) {
      logWebhookWarning("RevenueCat payload failed schema validation", {
        issues: parsed.error.issues.slice(0, 5),
      });
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }
    event = parsed.data.event;
    logWebhookReceived(`revenuecat.${event.type}`);

    // Idempotency: same event id already processed successfully → no-op 200.
    const existingEvent = await db
      .select()
      .from(webhookEvents)
      .where(eq(webhookEvents.eventId, event.id))
      .limit(1);
    if (existingEvent.length > 0 && existingEvent[0].status === "success") {
      logWebhookInfo(
        `Duplicate RevenueCat event ${event.id} (${event.type}) - already processed at ${existingEvent[0].processedAt}`,
      );
      return acknowledged({
        duplicate: true,
        originalProcessedAt: existingEvent[0].processedAt,
      });
    }

    // TRANSFER carries no app_user_id — alert-only path (D-status-mapping).
    if (event.type === "TRANSFER") {
      const transferredTo = event.transferred_to ?? [];
      const transferredFrom = event.transferred_from ?? [];
      await sendTransferAlert({
        eventId: event.id,
        transferredFrom,
        transferredTo,
      });
      const candidate = transferredTo.find((id) => UUID_RE.test(id)) ?? null;
      await recordEvent({
        event,
        userId: candidate,
        advanceCursor: false,
        note: `transfer: from=[${transferredFrom.join(",")}] to=[${transferredTo.join(",")}] (no entitlement write)`,
      });
      return acknowledged({ transfer: true, alerted: true });
    }

    // Resolve the subject user. app_user_id IS the Supabase user id
    // (D-rc-scope: Purchases.logIn(supabaseUserId) after auth); RevenueCat
    // anonymous ids ($RCAnonymousID:...) cannot map to a profile → skip.
    const appUserId = event.app_user_id ?? null;
    if (!appUserId || !UUID_RE.test(appUserId)) {
      logWebhookInfo(
        `Skipping RevenueCat event ${event.id} (${event.type}) - app_user_id is not a Supabase user id`,
      );
      await recordEvent({
        event,
        userId: null,
        advanceCursor: false,
        note: "skip: app_user_id not a supabase uuid",
      });
      return acknowledged({ skipped: "unrecognized-app-user-id" });
    }

    const profileRows = await db
      .select({
        id: profile.id,
        planSelected: profile.planSelected,
        subscriptionStatus: profile.subscriptionStatus,
        currentPeriodEnd: profile.currentPeriodEnd,
        cancelAtPeriodEnd: profile.cancelAtPeriodEnd,
        billingProvider: profile.billingProvider,
        // Captured for the optimistic-lock predicate on the final write.
        billingVersion: profile.billingVersion,
      })
      .from(profile)
      .where(eq(profile.id, appUserId))
      .limit(1);

    if (profileRows.length === 0) {
      logWebhookWarning(
        `RevenueCat event ${event.id} references unknown user ${appUserId} - skipping`,
      );
      await recordEvent({
        event,
        userId: null,
        advanceCursor: false,
        note: "skip: no profile for app_user_id",
      });
      return acknowledged({ skipped: "unknown-user" });
    }
    userId = profileRows[0].id;
    const billingVersionAtRead = profileRows[0].billingVersion;

    const projection: BillingProjection = {
      provider: profileRows[0].billingProvider,
      plan: profileRows[0].planSelected,
      status: profileRows[0].subscriptionStatus,
      currentPeriodEnd: profileRows[0].currentPeriodEnd,
      cancelAtPeriodEnd: profileRows[0].cancelAtPeriodEnd,
    };

    // Map the RC event into a normalized fact (or a skip).
    const mapped = mapRevenueCatEvent(event, projection);

    if (mapped.kind === "skip") {
      logWebhookInfo(
        `RevenueCat event ${event.id} (${event.type}) acknowledged without projection: ${mapped.reason}`,
      );
      await recordEvent({
        event,
        userId,
        advanceCursor: false,
        note: `skip: ${mapped.reason}`,
      });
      return acknowledged({ skipped: mapped.reason });
    }
    if (mapped.kind === "transfer") {
      // Unreachable (handled above) — kept for exhaustiveness.
      return acknowledged({ transfer: true });
    }

    // Per-provider ordering cursor: the latest successfully EVALUATED apple
    // event for this user (D23 — webhook_events carries the cursor).
    const cursorRows = await db
      .select({
        eventId: webhookEvents.eventId,
        eventTimeMs: webhookEvents.eventTimeMs,
      })
      .from(webhookEvents)
      .where(
        and(
          eq(webhookEvents.userId, userId),
          eq(webhookEvents.provider, PROVIDER),
          eq(webhookEvents.status, "success"),
          isNotNull(webhookEvents.eventTimeMs),
        ),
      )
      .orderBy(desc(webhookEvents.eventTimeMs))
      .limit(1);

    const current: CurrentBillingState = {
      projection,
      lastApplied:
        cursorRows.length > 0 && cursorRows[0].eventTimeMs !== null
          ? {
              eventTimeMs: cursorRows[0].eventTimeMs,
              eventId: cursorRows[0].eventId,
            }
          : null,
    };

    // THE merge chokepoint.
    const decision = applyBillingEvent(current, mapped.fact);

    if (decision.alert) {
      await sendDoubleContractAlert(userId, decision.alert);
    }

    if (decision.action === "ignore" && decision.reason === "stale-out-of-order") {
      logWebhookInfo(
        `RevenueCat event ${event.id} (${event.type}) is older than the applied ${PROVIDER} cursor - ignored`,
      );
      // Deliberately NOT advancing the cursor (the event is older than it).
      await recordEvent({
        event,
        userId,
        advanceCursor: false,
        note: "ignored: stale-out-of-order",
      });
      return acknowledged({ stale: true });
    }

    if (decision.changed) {
      // Optimistic concurrency: the write only lands if billing_version is
      // still what we read. Every write path (this route + the Stripe
      // handlers) bumps the version, so a concurrent webhook that already
      // wrote will make this predicate miss — preventing a stale event from
      // silently clobbering a higher entitlement past applyBillingEvent's
      // precedence logic.
      const updated = await db
        .update(profile)
        .set({
          planSelected: decision.projection.plan,
          planSelectedAt: new Date(),
          subscriptionStatus: decision.projection.status,
          currentPeriodEnd: decision.projection.currentPeriodEnd,
          cancelAtPeriodEnd: decision.projection.cancelAtPeriodEnd,
          billingProvider: decision.projection.provider,
          billingVersion: sql`billing_version + 1`,
        })
        .where(
          and(
            eq(profile.id, userId),
            eq(profile.billingVersion, billingVersionAtRead),
          ),
        )
        .returning({ id: profile.id });

      if (updated.length === 0) {
        // Lost the race. Do NOT record the event (no success/failure row) so
        // RevenueCat's redelivery re-runs read→decide→write against the
        // now-committed state and converges. Non-2xx triggers that retry.
        logWebhookWarning(
          `RevenueCat ${event.type} for user ${userId} hit a concurrent billing update (billing_version moved from ${billingVersionAtRead}) - asking RevenueCat to retry`,
        );
        return NextResponse.json(
          { error: "Concurrent billing update, retry" },
          { status: 409 },
        );
      }
      logWebhookSuccess(
        `RevenueCat ${event.type} applied for user ${userId}: plan=${decision.projection.plan} status=${decision.projection.status} provider=${decision.projection.provider} (${decision.reason})`,
      );
    } else {
      logWebhookInfo(
        `RevenueCat ${event.type} for user ${userId} produced no projection change (${decision.reason})`,
      );
    }

    await recordEvent({
      event,
      userId,
      advanceCursor: true,
      note: decision.alert
        ? `double_contract: kept ${decision.alert.keptProvider} (${decision.reason})`
        : decision.action === "ignore"
          ? `ignored: ${decision.reason}`
          : undefined,
    });

    return acknowledged({
      applied: decision.action === "apply",
      changed: decision.changed,
      reason: decision.reason,
      ...(decision.alert ? { doubleContract: true } : {}),
    });
  } catch (error) {
    logWebhookError("RevenueCat webhook handler failed", error);
    if (event?.id) {
      await recordFailure(
        event,
        userId,
        error instanceof Error ? error.message : "Unknown error",
      );
    }
    // Non-200 → RevenueCat retries (5/10/20/40/80 min).
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
