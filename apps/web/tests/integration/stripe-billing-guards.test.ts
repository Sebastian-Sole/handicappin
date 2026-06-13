/**
 * Stripe precedence-guard integration tests (handoff DoD #4).
 *
 * Exercises guardedStripeProfileWrite — the seam every Stripe webhook
 * handler now routes its final profile write through — against the REAL
 * local Supabase stack: seeded projection states, stripe-shaped facts,
 * assertions on the actual profile row.
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
import { createClient } from "@supabase/supabase-js";
import { eq } from "drizzle-orm";
import { sql } from "drizzle-orm";

const { db } = await import("@/db");
const { profile, webhookEvents } = await import("@/db/schema");
const { guardedStripeProfileWrite, decideStripeProfileWrite } = await import(
  "@/lib/stripe-webhook-handlers/profile-billing-write"
);

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

const TEST_EMAIL = "stripe-guards-test@handicappin.local";
const FUTURE_S = Math.floor(Date.parse("2027-06-12T00:00:00Z") / 1000);

let userId: string;
let factCounter = 0;

function stripeFact(overrides: Record<string, unknown> = {}) {
  factCounter += 1;
  return {
    provider: "stripe" as const,
    plan: "premium" as const,
    status: "active" as const,
    currentPeriodEnd: FUTURE_S,
    cancelAtPeriodEnd: false,
    eventTimeMs: Date.now(),
    eventId: `evt_guard_${factCounter}`,
    ...overrides,
  };
}

async function seedProjection(state: {
  plan: string | null;
  status: string | null;
  provider: string | null;
  periodEnd?: number | null;
  cancelAtPeriodEnd?: boolean;
}) {
  await db
    .update(profile)
    .set({
      planSelected: state.plan as never,
      subscriptionStatus: state.status as never,
      billingProvider: state.provider as never,
      currentPeriodEnd: state.periodEnd ?? null,
      cancelAtPeriodEnd: state.cancelAtPeriodEnd ?? false,
    })
    .where(eq(profile.id, userId));
}

async function getRow() {
  const rows = await db
    .select({
      planSelected: profile.planSelected,
      subscriptionStatus: profile.subscriptionStatus,
      currentPeriodEnd: profile.currentPeriodEnd,
      cancelAtPeriodEnd: profile.cancelAtPeriodEnd,
      billingProvider: profile.billingProvider,
    })
    .from(profile)
    .where(eq(profile.id, userId))
    .limit(1);
  return rows[0];
}

/** The write each test hands the guard — a full stripe-shaped update. */
function profileWrite(fact: ReturnType<typeof stripeFact>) {
  return async () => {
    await db
      .update(profile)
      .set({
        planSelected: fact.plan,
        subscriptionStatus: fact.status,
        currentPeriodEnd: fact.currentPeriodEnd,
        cancelAtPeriodEnd: fact.cancelAtPeriodEnd,
        billingProvider: "stripe",
        billingVersion: sql`billing_version + 1`,
      })
      .where(eq(profile.id, userId));
  };
}

describeIfLocal("Stripe precedence guards (real local Supabase)", () => {
  beforeAll(async () => {
    const admin = createClient(supabaseUrl!, serviceRoleKey!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
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
      throw new Error(`Failed to create guard test user: ${error?.message}`);
    }
    userId = created.user.id;
    await db.insert(profile).values({
      id: userId,
      email: TEST_EMAIL,
      name: "Stripe Guards Test",
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
    await seedProjection({ plan: null, status: null, provider: null });
  });

  test("stripe write onto a plan-less profile applies and stamps the provider", async () => {
    const fact = stripeFact();
    const { written } = await guardedStripeProfileWrite({
      userId,
      handler: "test",
      fact,
      write: profileWrite(fact),
    });
    expect(written).toBe(true);
    const row = await getRow();
    expect(row.planSelected).toBe("premium");
    expect(row.billingProvider).toBe("stripe");
  });

  test("stripe write onto its own contract applies (same-provider lifecycle)", async () => {
    await seedProjection({
      plan: "premium",
      status: "active",
      provider: "stripe",
      periodEnd: FUTURE_S,
    });
    const fact = stripeFact({ plan: "unlimited" });
    const { written } = await guardedStripeProfileWrite({
      userId,
      handler: "test",
      fact,
      write: profileWrite(fact),
    });
    expect(written).toBe(true);
    expect((await getRow()).planSelected).toBe("unlimited");
  });

  test("NEVER overwrites lifetime: stripe subscription event vs stripe lifetime", async () => {
    await seedProjection({
      plan: "lifetime",
      status: "active",
      provider: "stripe",
    });
    const fact = stripeFact({ plan: "premium" });
    const { written, verdict } = await guardedStripeProfileWrite({
      userId,
      handler: "test",
      fact,
      write: profileWrite(fact),
    });
    expect(written).toBe(false);
    expect(verdict && !verdict.allowed && verdict.blockedBy).toBe(
      "lifetime-locked",
    );
    const row = await getRow();
    expect(row.planSelected).toBe("lifetime");
  });

  test("NEVER overwrites an apple lifetime either", async () => {
    await seedProjection({
      plan: "lifetime",
      status: "active",
      provider: "apple",
    });
    const fact = stripeFact({ plan: "unlimited" });
    const { written } = await guardedStripeProfileWrite({
      userId,
      handler: "test",
      fact,
      write: profileWrite(fact),
    });
    expect(written).toBe(false);
    const row = await getRow();
    expect(row.planSelected).toBe("lifetime");
    expect(row.billingProvider).toBe("apple");
  });

  test("never clobbers an apple-active contract with a lower stripe tier (alerted)", async () => {
    await seedProjection({
      plan: "unlimited",
      status: "active",
      provider: "apple",
      periodEnd: FUTURE_S,
    });
    const fact = stripeFact({ plan: "premium" });
    const { written, verdict } = await guardedStripeProfileWrite({
      userId,
      handler: "test",
      fact,
      write: profileWrite(fact),
    });
    expect(written).toBe(false);
    expect(verdict && !verdict.allowed && verdict.blockedBy).toBe(
      "double-contract-current-wins",
    );
    expect(verdict?.decision.alert?.keptProvider).toBe("apple");
    const row = await getRow();
    expect(row.billingProvider).toBe("apple");
    expect(row.planSelected).toBe("unlimited");
  });

  test("a HIGHER stripe tier wins the double contract (and alerts)", async () => {
    await seedProjection({
      plan: "premium",
      status: "active",
      provider: "apple",
      periodEnd: FUTURE_S,
    });
    const fact = stripeFact({ plan: "unlimited" });
    const { written, verdict } = await guardedStripeProfileWrite({
      userId,
      handler: "test",
      fact,
      write: profileWrite(fact),
    });
    expect(written).toBe(true);
    expect(verdict?.decision.alert?.keptProvider).toBe("stripe");
    const row = await getRow();
    expect(row.billingProvider).toBe("stripe");
    expect(row.planSelected).toBe("unlimited");
  });

  test("stripe subscription-deleted (free fact) cannot kill an apple-active contract", async () => {
    await seedProjection({
      plan: "premium",
      status: "active",
      provider: "apple",
      periodEnd: FUTURE_S,
    });
    const fact = stripeFact({
      plan: "free",
      status: "canceled",
      currentPeriodEnd: null,
    });
    const { written, verdict } = await guardedStripeProfileWrite({
      userId,
      handler: "test",
      fact,
      write: profileWrite(fact),
    });
    expect(written).toBe(false);
    expect(verdict && !verdict.allowed && verdict.blockedBy).toBe(
      "inactive-foreign-contract",
    );
    const row = await getRow();
    expect(row.planSelected).toBe("premium");
    expect(row.billingProvider).toBe("apple");
  });

  test("stripe past_due fact cannot mark an apple-active contract past due", async () => {
    await seedProjection({
      plan: "unlimited",
      status: "active",
      provider: "apple",
      periodEnd: FUTURE_S,
    });
    // Mirrors handleInvoicePaymentFailed's fact for a non-stripe projection.
    const fact = stripeFact({
      plan: null,
      status: "past_due",
      currentPeriodEnd: null,
    });
    const { written } = await guardedStripeProfileWrite({
      userId,
      handler: "test",
      fact,
      write: profileWrite(fact),
    });
    expect(written).toBe(false);
    expect((await getRow()).subscriptionStatus).toBe("active");
  });

  test("stripe-active fact displaces a DEAD apple contract", async () => {
    await seedProjection({
      plan: "unlimited",
      status: "past_due",
      provider: "apple",
      periodEnd: FUTURE_S,
    });
    const fact = stripeFact({ plan: "premium" });
    const { written } = await guardedStripeProfileWrite({
      userId,
      handler: "test",
      fact,
      write: profileWrite(fact),
    });
    expect(written).toBe(true);
    const row = await getRow();
    expect(row.billingProvider).toBe("stripe");
    expect(row.planSelected).toBe("premium");
  });

  test("decideStripeProfileWrite is pure and mirrors the chokepoint verdicts", () => {
    const lifetimeProjection = {
      provider: "apple" as const,
      plan: "lifetime" as const,
      status: "active" as const,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    };
    const verdict = decideStripeProfileWrite(lifetimeProjection, stripeFact());
    expect(verdict.allowed).toBe(false);
    if (!verdict.allowed) {
      expect(verdict.blockedBy).toBe("lifetime-locked");
    }
  });
});
