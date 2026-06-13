/**
 * RevenueCat Webhook Integration Tests (handoff DoD #5)
 *
 * Hits the REAL route handler against the REAL local Supabase stack:
 * a dedicated auth user + profile row are created for the suite, RC-shaped
 * payloads are POSTed through the handler, and assertions read the actual
 * profile/webhook_events tables through the same drizzle client the
 * handler writes with.
 *
 * Requires `supabase start` (DATABASE_URL in .env.local points at it) —
 * same expectation as the rest of the integration suite.
 */
import {
  describe,
  test,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
} from "vitest";
import { randomUUID } from "crypto";
import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { and, eq } from "drizzle-orm";

const WEBHOOK_AUTH_TOKEN = "Bearer rc-test-shared-secret";
process.env.REVENUECAT_WEBHOOK_AUTH_TOKEN = WEBHOOK_AUTH_TOKEN;

// Import AFTER the env var is set — @/env snapshots process.env at import.
const { POST } = await import("@/app/api/webhooks/revenuecat/route");
const { db } = await import("@/db");
const { profile, webhookEvents } = await import("@/db/schema");
const { APPLE_SKUS } = await import("@handicappin/billing-core");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const databaseUrl = process.env.DATABASE_URL;

const isLocalStack =
  !!databaseUrl?.includes("127.0.0.1") || !!databaseUrl?.includes("localhost");

// CI points DATABASE_URL at a localhost placeholder but supplies DUMMY Supabase
// credentials (no real stack is provisioned). Dummy creds must count as "no
// local stack" so this suite skips in CI and runs only against a real
// `supabase start` — matching the dummy-key guard the Stripe suites use.
const hasRealSupabase =
  !!supabaseUrl &&
  !supabaseUrl.includes("dummy") &&
  !!serviceRoleKey &&
  !serviceRoleKey.includes("dummy");

const describeIfLocal =
  hasRealSupabase && isLocalStack ? describe : describe.skip;

const TEST_EMAIL = "rc-webhook-test@handicappin.local";

let userId: string;

/** Monotonic event clock — each call is 1s later than the previous. */
let clockMs = Date.now();
function nextEventTime(): number {
  clockMs += 1000;
  return clockMs;
}

interface RcEventOverrides {
  [key: string]: unknown;
}

function rcPayload(
  type: string,
  overrides: RcEventOverrides = {},
): Record<string, unknown> {
  return {
    api_version: "1.0",
    event: {
      id: randomUUID(),
      type,
      event_timestamp_ms: nextEventTime(),
      app_user_id: userId,
      original_app_user_id: userId,
      aliases: [userId],
      store: "APP_STORE",
      environment: "SANDBOX",
      period_type: "NORMAL",
      ...overrides,
    },
  };
}

function makeRequest(
  body: unknown,
  headers: Record<string, string> = { authorization: WEBHOOK_AUTH_TOKEN },
): NextRequest {
  return new NextRequest("http://localhost:3000/api/webhooks/revenuecat", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

async function getProfileRow() {
  const rows = await db
    .select({
      planSelected: profile.planSelected,
      subscriptionStatus: profile.subscriptionStatus,
      currentPeriodEnd: profile.currentPeriodEnd,
      cancelAtPeriodEnd: profile.cancelAtPeriodEnd,
      billingProvider: profile.billingProvider,
      billingVersion: profile.billingVersion,
    })
    .from(profile)
    .where(eq(profile.id, userId))
    .limit(1);
  expect(rows.length).toBe(1);
  return rows[0];
}

async function setProfileBilling(state: {
  plan: string | null;
  status: string | null;
  periodEnd?: number | null;
  cancelAtPeriodEnd?: boolean;
  provider?: string | null;
}) {
  await db
    .update(profile)
    .set({
      planSelected: state.plan as never,
      subscriptionStatus: state.status as never,
      currentPeriodEnd: state.periodEnd ?? null,
      cancelAtPeriodEnd: state.cancelAtPeriodEnd ?? false,
      billingProvider: (state.provider ?? null) as never,
    })
    .where(eq(profile.id, userId));
}

async function clearWebhookEventsForUser() {
  await db.delete(webhookEvents).where(eq(webhookEvents.userId, userId));
}

const FUTURE_MS = Date.parse("2027-06-12T00:00:00.000Z");
const FUTURE_S = Math.floor(FUTURE_MS / 1000);
const LATER_MS = FUTURE_MS + 30 * 86_400_000;
const LATER_S = Math.floor(LATER_MS / 1000);

describeIfLocal("RevenueCat webhook (real local Supabase)", () => {
  beforeAll(async () => {
    const admin = createClient(supabaseUrl!, serviceRoleKey!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Recreate the suite user from scratch.
    const { data: usersPage } = await admin.auth.admin.listUsers();
    const existing = usersPage?.users.find((u) => u.email === TEST_EMAIL);
    if (existing) {
      await db.delete(webhookEvents).where(eq(webhookEvents.userId, existing.id));
      await db.delete(profile).where(eq(profile.id, existing.id));
      await admin.auth.admin.deleteUser(existing.id);
    }

    const { data: created, error } = await admin.auth.admin.createUser({
      email: TEST_EMAIL,
      email_confirm: true,
      password: randomUUID(),
    });
    if (error || !created.user) {
      throw new Error(`Failed to create RC test user: ${error?.message}`);
    }
    userId = created.user.id;

    await db.insert(profile).values({
      id: userId,
      email: TEST_EMAIL,
      name: "RC Webhook Test",
      verified: true,
    });
  }, 30_000);

  afterAll(async () => {
    if (!userId) return;
    const admin = createClient(supabaseUrl!, serviceRoleKey!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    await db.delete(webhookEvents).where(eq(webhookEvents.userId, userId));
    await db.delete(profile).where(eq(profile.id, userId));
    await admin.auth.admin.deleteUser(userId);
  }, 30_000);

  beforeEach(async () => {
    // Each test starts from a clean slate: plan-less profile, empty cursor.
    await clearWebhookEventsForUser();
    await setProfileBilling({ plan: null, status: null, provider: null });
  });

  // -------------------------------------------------------------------------
  // Security / protocol
  // -------------------------------------------------------------------------

  test("bad Authorization header → 401, nothing recorded", async () => {
    const res = await POST(
      makeRequest(rcPayload("INITIAL_PURCHASE"), {
        authorization: "Bearer wrong-secret",
      }),
    );
    expect(res.status).toBe(401);
    const row = await getProfileRow();
    expect(row.planSelected).toBeNull();
  });

  test("missing Authorization header → 401", async () => {
    const res = await POST(makeRequest(rcPayload("INITIAL_PURCHASE"), {}));
    expect(res.status).toBe(401);
  });

  test("invalid JSON body → 400", async () => {
    const req = new NextRequest("http://localhost:3000/api/webhooks/revenuecat", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: WEBHOOK_AUTH_TOKEN,
      },
      body: "not-json{",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  test("schema-invalid payload (no event id) → 400", async () => {
    const payload = rcPayload("INITIAL_PURCHASE");
    delete (payload.event as Record<string, unknown>).id;
    const res = await POST(makeRequest(payload));
    expect(res.status).toBe(400);
  });

  // -------------------------------------------------------------------------
  // Event mapping (D-status-mapping)
  // -------------------------------------------------------------------------

  test("INITIAL_PURCHASE (premium yearly) grants premium/active/apple", async () => {
    const before = await getProfileRow();
    const res = await POST(
      makeRequest(
        rcPayload("INITIAL_PURCHASE", {
          product_id: APPLE_SKUS.premiumYearly,
          expiration_at_ms: FUTURE_MS,
          purchased_at_ms: Date.now(),
        }),
      ),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.applied).toBe(true);
    expect(body.changed).toBe(true);

    const row = await getProfileRow();
    expect(row.planSelected).toBe("premium");
    expect(row.subscriptionStatus).toBe("active");
    expect(row.billingProvider).toBe("apple");
    expect(row.currentPeriodEnd).toBe(FUTURE_S);
    expect(row.cancelAtPeriodEnd).toBe(false);
    expect(row.billingVersion).toBe(before.billingVersion + 1);
  });

  test("INITIAL_PURCHASE with TRIAL period maps to trialing", async () => {
    await POST(
      makeRequest(
        rcPayload("INITIAL_PURCHASE", {
          product_id: APPLE_SKUS.unlimitedYearly,
          expiration_at_ms: FUTURE_MS,
          period_type: "TRIAL",
        }),
      ),
    );
    const row = await getProfileRow();
    expect(row.planSelected).toBe("unlimited");
    expect(row.subscriptionStatus).toBe("trialing");
  });

  test("RENEWAL extends the period", async () => {
    await POST(
      makeRequest(
        rcPayload("INITIAL_PURCHASE", {
          product_id: APPLE_SKUS.unlimitedYearly,
          expiration_at_ms: FUTURE_MS,
        }),
      ),
    );
    const res = await POST(
      makeRequest(
        rcPayload("RENEWAL", {
          product_id: APPLE_SKUS.unlimitedYearly,
          expiration_at_ms: LATER_MS,
        }),
      ),
    );
    expect(res.status).toBe(200);
    const row = await getProfileRow();
    expect(row.currentPeriodEnd).toBe(LATER_S);
    expect(row.subscriptionStatus).toBe("active");
  });

  test("PRODUCT_CHANGE is acknowledged but writes nothing (RENEWAL carries the product)", async () => {
    await POST(
      makeRequest(
        rcPayload("INITIAL_PURCHASE", {
          product_id: APPLE_SKUS.unlimitedYearly,
          expiration_at_ms: FUTURE_MS,
        }),
      ),
    );
    const before = await getProfileRow();

    const res = await POST(
      makeRequest(
        rcPayload("PRODUCT_CHANGE", {
          product_id: APPLE_SKUS.unlimitedYearly,
          new_product_id: APPLE_SKUS.premiumYearly,
          expiration_at_ms: FUTURE_MS,
        }),
      ),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.skipped).toBe("product-change-informational");

    const after = await getProfileRow();
    expect(after).toEqual(before);

    // The deferred downgrade lands via RENEWAL with the new product.
    await POST(
      makeRequest(
        rcPayload("RENEWAL", {
          product_id: APPLE_SKUS.premiumYearly,
          expiration_at_ms: LATER_MS,
        }),
      ),
    );
    const downgraded = await getProfileRow();
    expect(downgraded.planSelected).toBe("premium");
  });

  test("CANCELLATION sets cancel_at_period_end, keeps entitlement until period end", async () => {
    await POST(
      makeRequest(
        rcPayload("INITIAL_PURCHASE", {
          product_id: APPLE_SKUS.premiumYearly,
          expiration_at_ms: FUTURE_MS,
        }),
      ),
    );
    const res = await POST(
      makeRequest(
        rcPayload("CANCELLATION", {
          product_id: APPLE_SKUS.premiumYearly,
          cancel_reason: "UNSUBSCRIBE",
          expiration_at_ms: FUTURE_MS,
        }),
      ),
    );
    expect(res.status).toBe(200);
    const row = await getProfileRow();
    expect(row.cancelAtPeriodEnd).toBe(true);
    expect(row.planSelected).toBe("premium");
    expect(row.subscriptionStatus).toBe("active");
    expect(row.currentPeriodEnd).toBe(FUTURE_S);
  });

  test("UNCANCELLATION clears cancel_at_period_end", async () => {
    await POST(
      makeRequest(
        rcPayload("INITIAL_PURCHASE", {
          product_id: APPLE_SKUS.premiumYearly,
          expiration_at_ms: FUTURE_MS,
        }),
      ),
    );
    await POST(
      makeRequest(
        rcPayload("CANCELLATION", {
          product_id: APPLE_SKUS.premiumYearly,
          cancel_reason: "UNSUBSCRIBE",
        }),
      ),
    );
    const res = await POST(
      makeRequest(
        rcPayload("UNCANCELLATION", {
          product_id: APPLE_SKUS.premiumYearly,
        }),
      ),
    );
    expect(res.status).toBe(200);
    const row = await getProfileRow();
    expect(row.cancelAtPeriodEnd).toBe(false);
    expect(row.subscriptionStatus).toBe("active");
  });

  test("BILLING_ISSUE moves status to past_due (denies access immediately)", async () => {
    await POST(
      makeRequest(
        rcPayload("INITIAL_PURCHASE", {
          product_id: APPLE_SKUS.unlimitedYearly,
          expiration_at_ms: FUTURE_MS,
        }),
      ),
    );
    const res = await POST(
      makeRequest(
        rcPayload("BILLING_ISSUE", {
          product_id: APPLE_SKUS.unlimitedYearly,
          expiration_at_ms: FUTURE_MS,
          grace_period_expiration_at_ms: LATER_MS,
        }),
      ),
    );
    expect(res.status).toBe(200);
    const row = await getProfileRow();
    expect(row.subscriptionStatus).toBe("past_due");
    expect(row.planSelected).toBe("unlimited");
    expect(row.billingProvider).toBe("apple");
  });

  test("EXPIRATION reverts to free/canceled and clears the provider", async () => {
    await POST(
      makeRequest(
        rcPayload("INITIAL_PURCHASE", {
          product_id: APPLE_SKUS.premiumYearly,
          expiration_at_ms: FUTURE_MS,
        }),
      ),
    );
    const res = await POST(
      makeRequest(
        rcPayload("EXPIRATION", {
          product_id: APPLE_SKUS.premiumYearly,
          expiration_reason: "UNSUBSCRIBE",
        }),
      ),
    );
    expect(res.status).toBe(200);
    const row = await getProfileRow();
    expect(row.planSelected).toBe("free");
    expect(row.subscriptionStatus).toBe("canceled");
    expect(row.billingProvider).toBeNull();
    expect(row.currentPeriodEnd).toBeNull();
    expect(row.cancelAtPeriodEnd).toBe(false);
  });

  test("NON_RENEWING_PURCHASE of the lifetime SKU grants lifetime", async () => {
    const res = await POST(
      makeRequest(
        rcPayload("NON_RENEWING_PURCHASE", {
          product_id: APPLE_SKUS.lifetime,
        }),
      ),
    );
    expect(res.status).toBe(200);
    const row = await getProfileRow();
    expect(row.planSelected).toBe("lifetime");
    expect(row.subscriptionStatus).toBe("active");
    expect(row.billingProvider).toBe("apple");
    expect(row.currentPeriodEnd).toBeNull();
  });

  test("unknown product id is acknowledged without write", async () => {
    const res = await POST(
      makeRequest(
        rcPayload("INITIAL_PURCHASE", {
          product_id: "com.handicappin.bogus.monthly",
          expiration_at_ms: FUTURE_MS,
        }),
      ),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.skipped).toBe("unknown-product");
    const row = await getProfileRow();
    expect(row.planSelected).toBeNull();
  });

  test("non-APP_STORE store is acknowledged without write (D-rc-scope)", async () => {
    const res = await POST(
      makeRequest(
        rcPayload("INITIAL_PURCHASE", {
          product_id: APPLE_SKUS.premiumYearly,
          store: "PLAY_STORE",
          expiration_at_ms: FUTURE_MS,
        }),
      ),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.skipped).toBe("unsupported-store");
  });

  test("TRANSFER is alert-only: no entitlement write, alert recorded", async () => {
    await setProfileBilling({
      plan: "premium",
      status: "active",
      provider: "apple",
      periodEnd: FUTURE_S,
    });
    const payload = rcPayload("TRANSFER", {
      transferred_from: ["some-old-user"],
      transferred_to: [userId],
    });
    delete (payload.event as Record<string, unknown>).app_user_id;
    const eventId = (payload.event as Record<string, unknown>).id as string;

    const res = await POST(makeRequest(payload));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.transfer).toBe(true);
    expect(body.alerted).toBe(true);

    const row = await getProfileRow();
    expect(row.planSelected).toBe("premium"); // untouched

    const recorded = await db
      .select()
      .from(webhookEvents)
      .where(eq(webhookEvents.eventId, eventId))
      .limit(1);
    expect(recorded.length).toBe(1);
    expect(recorded[0].status).toBe("success");
    expect(recorded[0].errorMessage).toContain("transfer:");
    expect(recorded[0].eventTimeMs).toBeNull(); // cursor NOT advanced
  });

  // -------------------------------------------------------------------------
  // Idempotency + ordering
  // -------------------------------------------------------------------------

  test("duplicate event id → idempotent 200, no second apply", async () => {
    const payload = rcPayload("INITIAL_PURCHASE", {
      product_id: APPLE_SKUS.premiumYearly,
      expiration_at_ms: FUTURE_MS,
    });
    const first = await POST(makeRequest(payload));
    expect(first.status).toBe(200);
    const afterFirst = await getProfileRow();

    const second = await POST(makeRequest(payload));
    expect(second.status).toBe(200);
    const body = await second.json();
    expect(body.duplicate).toBe(true);

    const afterSecond = await getProfileRow();
    expect(afterSecond).toEqual(afterFirst); // billing_version untouched
  });

  test("stale event (older than the applied cursor) is ignored", async () => {
    // Apply a purchase at t, then replay an older-but-different event.
    const purchase = rcPayload("INITIAL_PURCHASE", {
      product_id: APPLE_SKUS.unlimitedYearly,
      expiration_at_ms: FUTURE_MS,
    });
    const purchaseTime = (purchase.event as Record<string, unknown>)
      .event_timestamp_ms as number;
    await POST(makeRequest(purchase));
    const applied = await getProfileRow();

    const stale = rcPayload("CANCELLATION", {
      product_id: APPLE_SKUS.unlimitedYearly,
      cancel_reason: "UNSUBSCRIBE",
    });
    (stale.event as Record<string, unknown>).event_timestamp_ms =
      purchaseTime - 60_000;

    const res = await POST(makeRequest(stale));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.stale).toBe(true);

    const after = await getProfileRow();
    expect(after).toEqual(applied); // cancellation did NOT apply
  });

  // -------------------------------------------------------------------------
  // Cross-provider precedence through the real route
  // -------------------------------------------------------------------------

  test("double-contract: apple purchase over ACTIVE stripe sub keeps max entitlement + records alert", async () => {
    await setProfileBilling({
      plan: "premium",
      status: "active",
      provider: "stripe",
      periodEnd: FUTURE_S,
    });
    const payload = rcPayload("INITIAL_PURCHASE", {
      product_id: APPLE_SKUS.unlimitedYearly,
      expiration_at_ms: LATER_MS,
    });
    const eventId = (payload.event as Record<string, unknown>).id as string;

    const res = await POST(makeRequest(payload));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.doubleContract).toBe(true);

    // Max entitlement: apple unlimited beats stripe premium.
    const row = await getProfileRow();
    expect(row.planSelected).toBe("unlimited");
    expect(row.billingProvider).toBe("apple");

    const recorded = await db
      .select()
      .from(webhookEvents)
      .where(eq(webhookEvents.eventId, eventId))
      .limit(1);
    expect(recorded[0].errorMessage).toContain("double_contract: kept apple");
  });

  test("double-contract: LOWER apple tier does not displace stripe unlimited — state preserved + alert recorded", async () => {
    await setProfileBilling({
      plan: "unlimited",
      status: "active",
      provider: "stripe",
      periodEnd: FUTURE_S,
    });
    const payload = rcPayload("INITIAL_PURCHASE", {
      product_id: APPLE_SKUS.premiumYearly,
      expiration_at_ms: LATER_MS,
    });
    const eventId = (payload.event as Record<string, unknown>).id as string;

    const res = await POST(makeRequest(payload));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.doubleContract).toBe(true);
    expect(body.applied).toBe(false);

    const row = await getProfileRow();
    expect(row.planSelected).toBe("unlimited");
    expect(row.billingProvider).toBe("stripe"); // never auto-cancelled/changed

    const recorded = await db
      .select()
      .from(webhookEvents)
      .where(eq(webhookEvents.eventId, eventId))
      .limit(1);
    expect(recorded[0].errorMessage).toContain("double_contract: kept stripe");
  });

  test("lifetime is never overwritten: apple EXPIRATION cannot kill a stripe lifetime", async () => {
    await setProfileBilling({
      plan: "lifetime",
      status: "active",
      provider: "stripe",
    });
    const res = await POST(
      makeRequest(
        rcPayload("EXPIRATION", {
          product_id: APPLE_SKUS.premiumYearly,
          expiration_reason: "UNSUBSCRIBE",
        }),
      ),
    );
    expect(res.status).toBe(200);
    const row = await getProfileRow();
    expect(row.planSelected).toBe("lifetime");
    expect(row.billingProvider).toBe("stripe");
  });

  test("apple events for a stripe-active user's foreign dead contract are ignored", async () => {
    await setProfileBilling({
      plan: "premium",
      status: "active",
      provider: "stripe",
      periodEnd: FUTURE_S,
    });
    const res = await POST(
      makeRequest(
        rcPayload("EXPIRATION", {
          product_id: APPLE_SKUS.premiumYearly,
          expiration_reason: "UNSUBSCRIBE",
        }),
      ),
    );
    expect(res.status).toBe(200);
    const row = await getProfileRow();
    expect(row.planSelected).toBe("premium");
    expect(row.billingProvider).toBe("stripe");
  });

  test("full lifecycle: purchase → billing issue → recovery renewal → cancel → expire", async () => {
    await POST(
      makeRequest(
        rcPayload("INITIAL_PURCHASE", {
          product_id: APPLE_SKUS.unlimitedYearly,
          expiration_at_ms: FUTURE_MS,
        }),
      ),
    );
    await POST(
      makeRequest(
        rcPayload("BILLING_ISSUE", {
          product_id: APPLE_SKUS.unlimitedYearly,
          expiration_at_ms: FUTURE_MS,
        }),
      ),
    );
    expect((await getProfileRow()).subscriptionStatus).toBe("past_due");

    await POST(
      makeRequest(
        rcPayload("RENEWAL", {
          product_id: APPLE_SKUS.unlimitedYearly,
          expiration_at_ms: LATER_MS,
        }),
      ),
    );
    const recovered = await getProfileRow();
    expect(recovered.subscriptionStatus).toBe("active");
    expect(recovered.currentPeriodEnd).toBe(LATER_S);

    await POST(
      makeRequest(
        rcPayload("CANCELLATION", {
          product_id: APPLE_SKUS.unlimitedYearly,
          cancel_reason: "UNSUBSCRIBE",
        }),
      ),
    );
    expect((await getProfileRow()).cancelAtPeriodEnd).toBe(true);

    await POST(
      makeRequest(
        rcPayload("EXPIRATION", {
          product_id: APPLE_SKUS.unlimitedYearly,
          expiration_reason: "UNSUBSCRIBE",
        }),
      ),
    );
    const expired = await getProfileRow();
    expect(expired.planSelected).toBe("free");
    expect(expired.billingProvider).toBeNull();
  });

  test("TEST event from the RC dashboard is acknowledged without write", async () => {
    const res = await POST(makeRequest(rcPayload("TEST")));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.skipped).toBe("test-event");
  });

  test("unhandled event types (e.g. SUBSCRIPTION_EXTENDED) are acknowledged and recorded without cursor advance", async () => {
    const payload = rcPayload("SUBSCRIPTION_EXTENDED", {
      product_id: APPLE_SKUS.premiumYearly,
      expiration_at_ms: LATER_MS,
    });
    const eventId = (payload.event as Record<string, unknown>).id as string;
    const res = await POST(makeRequest(payload));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.skipped).toBe("unhandled-type");

    const recorded = await db
      .select()
      .from(webhookEvents)
      .where(eq(webhookEvents.eventId, eventId))
      .limit(1);
    expect(recorded[0].eventTimeMs).toBeNull();
  });

  test("events recorded with provider=apple and event time advance the cursor", async () => {
    const payload = rcPayload("INITIAL_PURCHASE", {
      product_id: APPLE_SKUS.premiumYearly,
      expiration_at_ms: FUTURE_MS,
    });
    const eventId = (payload.event as Record<string, unknown>).id as string;
    const eventTime = (payload.event as Record<string, unknown>)
      .event_timestamp_ms as number;
    await POST(makeRequest(payload));

    const recorded = await db
      .select()
      .from(webhookEvents)
      .where(
        and(eq(webhookEvents.eventId, eventId), eq(webhookEvents.status, "success")),
      )
      .limit(1);
    expect(recorded[0].provider).toBe("apple");
    expect(recorded[0].eventTimeMs).toBe(eventTime);
    expect(recorded[0].eventType).toBe("revenuecat.INITIAL_PURCHASE");
  });
});
