import {
  pgTable,
  uniqueIndex,
  foreignKey,
  pgPolicy,
  uuid,
  text,
  decimal,
  boolean,
  serial,
  integer,
  bigint,
  timestamp,
  pgSchema,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createSelectSchema } from "drizzle-zod";
import type { InferSelectModel } from "drizzle-orm";
import type { PlanType, SubscriptionStatus } from "@/lib/stripe-types";

const authSchema = pgSchema("auth");

export const usersInAuth = authSchema.table("users", {
  id: uuid("id").primaryKey(),
});

export const profile = pgTable(
  "profile",
  {
    id: uuid().primaryKey().notNull(),
    // Note: email is stored in auth.users table only - join with auth.users for email access
    name: text(),
    handicapIndex: decimal<"number">().notNull().default(54),
    verified: boolean().default(false).notNull(),
    initialHandicapIndex: decimal<"number">().notNull().default(54),
    createdAt: timestamp()
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),

    // Billing/plan tracking fields
    planSelected: text("plan_selected").$type<PlanType | null>(),
    planSelectedAt: timestamp("plan_selected_at"),

    // NEW: Subscription status tracking for JWT claims
    subscriptionStatus: text("subscription_status").$type<SubscriptionStatus | null>(),
    currentPeriodEnd: bigint("current_period_end", { mode: "number" }), // Y2038-proof unix timestamp
    cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false).notNull(),
    billingVersion: integer("billing_version").default(1).notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.id],
      foreignColumns: [usersInAuth.id],
      name: "profile_id_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    pgPolicy("Users can view their own profile", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
      using: sql`(auth.uid()::uuid = id)`,
    }),
    pgPolicy("Users can update their own profile", {
      as: "permissive",
      for: "update",
      to: ["authenticated"],
      using: sql`(auth.uid()::uuid = id)`,
      withCheck: sql`(
        auth.uid()::uuid = id
        AND plan_selected IS NOT DISTINCT FROM (SELECT plan_selected FROM profile WHERE id = auth.uid())
        AND subscription_status IS NOT DISTINCT FROM (SELECT subscription_status FROM profile WHERE id = auth.uid())
        AND current_period_end IS NOT DISTINCT FROM (SELECT current_period_end FROM profile WHERE id = auth.uid())
        AND cancel_at_period_end IS NOT DISTINCT FROM (SELECT cancel_at_period_end FROM profile WHERE id = auth.uid())
        AND billing_version IS NOT DISTINCT FROM (SELECT billing_version FROM profile WHERE id = auth.uid())
      )`,
    }),
    pgPolicy("Users can insert their own profile", {
      as: "permissive",
      for: "insert",
      to: ["authenticated"],
      withCheck: sql`(auth.uid()::uuid = id)`,
    }),
    pgPolicy("Users can delete their own profile", {
      as: "permissive",
      for: "delete",
      to: ["authenticated"],
      using: sql`(auth.uid()::uuid = id)`,
    }),
  ]
);

export const profileSchema = createSelectSchema(profile);
export type Profile = InferSelectModel<typeof profile>;

export const course = pgTable(
  "course",
  {
    id: serial().primaryKey().notNull(),
    name: text().notNull(),
    approvalStatus: text().default("pending").notNull(),
    country: text().default("Scotland").notNull(),
    city: text().notNull().default("St. Andrews"),
    website: text(),
  },
  (table) => [
    uniqueIndex("course_name_country_city_key").using(
      "btree",
      table.name.asc().nullsLast().op("text_ops"),
      table.country.asc().nullsLast().op("text_ops"),
      table.city.asc().nullsLast().op("text_ops")
    ),
    pgPolicy("Authenticated users can view courses", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
      using: sql`true`,
    }),
  ]
);

export const courseSchema = createSelectSchema(course);
export type Course = InferSelectModel<typeof course>;

export const teeInfo = pgTable(
  "teeInfo",
  {
    id: serial().primaryKey().notNull(),
    courseId: integer().notNull(),
    name: text().notNull(),
    gender: text().notNull(),
    courseRating18: decimal<"number">().notNull(),
    slopeRating18: integer().notNull(),
    courseRatingFront9: decimal<"number">().notNull(),
    slopeRatingFront9: integer().notNull(),
    courseRatingBack9: decimal<"number">().notNull(),
    slopeRatingBack9: integer().notNull(),
    outPar: integer().notNull(),
    inPar: integer().notNull(),
    totalPar: integer().notNull(),
    outDistance: integer().notNull(),
    inDistance: integer().notNull(),
    totalDistance: integer().notNull(),
    distanceMeasurement: text().notNull().default("yards"),
    approvalStatus: text().default("pending").notNull(),
    isArchived: boolean().default(false).notNull(),
    version: integer().default(1).notNull(),
  },
  (table) => [
    uniqueIndex("teeInfo_courseId_name_gender_key").using(
      "btree",
      table.courseId.asc().nullsLast().op("int4_ops"),
      table.name.asc().nullsLast().op("text_ops"),
      table.gender.asc().nullsLast().op("text_ops")
    ),
    foreignKey({
      columns: [table.courseId],
      foreignColumns: [course.id],
      name: "teeInfo_courseId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    pgPolicy("Authenticated users can view tee info", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
      using: sql`true`,
    }),
  ]
);

export const teeInfoSchema = createSelectSchema(teeInfo);
export type TeeInfo = InferSelectModel<typeof teeInfo>;

export const hole = pgTable(
  "hole",
  {
    id: serial().primaryKey().notNull(),
    teeId: integer().notNull(),
    holeNumber: integer().notNull(),
    par: integer().notNull(),
    distance: integer().notNull(),
    hcp: integer().notNull(),
  },
  (table) => [
    uniqueIndex("hole_teeId_holeNumber_key").using(
      "btree",
      table.teeId.asc().nullsLast().op("int4_ops"),
      table.holeNumber.asc().nullsLast().op("int4_ops")
    ),
    foreignKey({
      columns: [table.teeId],
      foreignColumns: [teeInfo.id],
      name: "hole_teeId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    pgPolicy("Authenticated users can view holes", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
      using: sql`true`,
    }),
  ]
);

export const holeSchema = createSelectSchema(hole);
export type Hole = InferSelectModel<typeof hole>;

export const round = pgTable(
  "round",
  {
    id: serial().primaryKey().notNull(),
    userId: uuid().notNull(),
    courseId: integer().notNull(),
    teeId: integer().notNull(),
    teeTime: timestamp().notNull(),
    totalStrokes: integer().notNull(),
    parPlayed: integer().notNull(),
    adjustedGrossScore: integer().notNull(),
    adjustedPlayedScore: integer().notNull(),
    courseHandicap: integer().notNull(),
    scoreDifferential: decimal<"number">().notNull(),
    existingHandicapIndex: decimal<"number">().notNull(),
    updatedHandicapIndex: decimal<"number">().notNull(),
    exceptionalScoreAdjustment: decimal<"number">().default(0).notNull(),
    notes: text(),
    approvalStatus: text().default("pending").notNull(),
    createdAt: timestamp()
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    index("idx_round_userId").on(table.userId),
    foreignKey({
      columns: [table.courseId],
      foreignColumns: [course.id],
      name: "round_courseId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("restrict"),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [profile.id],
      name: "round_userId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    foreignKey({
      columns: [table.teeId],
      foreignColumns: [teeInfo.id],
      name: "round_teeId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("restrict"),
    pgPolicy("Users can view their own rounds", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
      using: sql`(auth.uid()::uuid = userId)`,
    }),
    pgPolicy("Users can insert their own rounds", {
      as: "permissive",
      for: "insert",
      to: ["authenticated"],
      withCheck: sql`(auth.uid()::uuid = userId)`,
    }),
    pgPolicy("Users can update their own rounds", {
      as: "permissive",
      for: "update",
      to: ["authenticated"],
      using: sql`(auth.uid()::uuid = userId)`,
    }),
    pgPolicy("Users can delete their own rounds", {
      as: "permissive",
      for: "delete",
      to: ["authenticated"],
      using: sql`(auth.uid()::uuid = userId)`,
    }),
  ]
);

export const roundSchema = createSelectSchema(round);
export type Round = InferSelectModel<typeof round>;

export const score = pgTable(
  "score",
  {
    id: serial().primaryKey().notNull(),
    userId: uuid().notNull(),
    roundId: integer().notNull(),
    holeId: integer().notNull(),
    strokes: integer().notNull(),
    hcpStrokes: integer().default(0).notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.roundId],
      foreignColumns: [round.id],
      name: "score_roundId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    foreignKey({
      columns: [table.holeId],
      foreignColumns: [hole.id],
      name: "score_holeId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("restrict"),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [profile.id],
      name: "score_userId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    pgPolicy("Users can view their own scores", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
      using: sql`(auth.uid()::uuid = userId)`,
    }),
    pgPolicy("Users can insert their own scores", {
      as: "permissive",
      for: "insert",
      to: ["authenticated"],
      withCheck: sql`(auth.uid()::uuid = userId)`,
    }),
    pgPolicy("Users can update their own scores", {
      as: "permissive",
      for: "update",
      to: ["authenticated"],
      using: sql`(auth.uid()::uuid = userId)`,
    }),
    pgPolicy("Users can delete their own scores", {
      as: "permissive",
      for: "delete",
      to: ["authenticated"],
      using: sql`(auth.uid()::uuid = userId)`,
    }),
  ]
);

export const scoreSchema = createSelectSchema(score);
export type Score = InferSelectModel<typeof score>;

// Stripe customers table for managing Stripe customer IDs
export const stripeCustomers = pgTable(
  "stripe_customers",
  {
    userId: uuid("user_id").primaryKey().notNull(),
    stripeCustomerId: text("stripe_customer_id").notNull().unique(),
    createdAt: timestamp("created_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [profile.id],
      name: "stripe_customers_user_id_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    pgPolicy("Users can view their own stripe customer", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
      using: sql`(auth.uid()::uuid = user_id)`,
    }),
  ]
);

export const stripeCustomersSchema = createSelectSchema(stripeCustomers);
export type StripeCustomer = InferSelectModel<typeof stripeCustomers>;

// Webhook idempotency tracking table
export const webhookEvents = pgTable(
  "webhook_events",
  {
    eventId: text("event_id").primaryKey().notNull(),
    eventType: text("event_type").notNull(),
    processedAt: timestamp("processed_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    status: text("status").$type<"success" | "failed">().notNull(),
    errorMessage: text("error_message"),
    retryCount: integer("retry_count").default(0).notNull(),
    userId: uuid("user_id"),
  },
  (table) => [
    index("idx_webhook_events_event_type").on(table.eventType),
    index("idx_webhook_events_user_id").on(table.userId),
    index("idx_webhook_events_processed_at").on(table.processedAt),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [profile.id],
      name: "webhook_events_user_id_fkey",
    })
      .onUpdate("cascade")
      .onDelete("set null"), // Don't delete events when user is deleted
    // Note: No RLS policies - this is a system table accessed only by webhook handler
  ]
);

export const webhookEventsSchema = createSelectSchema(webhookEvents);
export type WebhookEvent = InferSelectModel<typeof webhookEvents>;

// Pending lifetime purchases - tracks payment mode checkouts awaiting payment confirmation
export const pendingLifetimePurchases = pgTable(
  "pending_lifetime_purchases",
  {
    id: serial("id").primaryKey(),
    userId: uuid("user_id").notNull(),
    checkoutSessionId: text("checkout_session_id").notNull().unique(),
    paymentIntentId: text("payment_intent_id"),
    priceId: text("price_id").notNull(),
    plan: text("plan").$type<"lifetime">().notNull(),
    status: text("status").$type<"pending" | "paid" | "failed">().notNull(),
    createdAt: timestamp("created_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updated_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    index("idx_pending_lifetime_user").on(table.userId),
    index("idx_pending_lifetime_payment_intent").on(table.paymentIntentId),
    index("idx_pending_lifetime_status").on(table.status),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [profile.id],
      name: "pending_lifetime_purchases_user_id_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"), // Delete pending purchases when user is deleted
    pgPolicy("Users can view their own pending purchases", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
      using: sql`(auth.uid()::uuid = user_id)`,
    }),
    // Note: Write operations handled by service role via webhooks
  ]
);

export const pendingLifetimePurchasesSchema = createSelectSchema(pendingLifetimePurchases);
export type PendingLifetimePurchase = InferSelectModel<typeof pendingLifetimePurchases>;

// Handicap calculation queue - tracks users needing handicap recalculation
export const handicapCalculationQueue = pgTable(
  "handicap_calculation_queue",
  {
    id: serial("id").primaryKey(),
    userId: uuid("user_id").notNull().unique(),
    eventType: text("event_type").notNull(),
    createdAt: timestamp("created_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    lastUpdated: timestamp("last_updated")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    status: text("status")
      .$type<"pending" | "failed">()
      .default("pending")
      .notNull(),
    attempts: integer("attempts").default(0).notNull(),
    errorMessage: text("error_message"),
  },
  (table) => [
    index("idx_handicap_queue_status_created").on(
      table.status,
      table.createdAt
    ),
    index("idx_handicap_queue_user_id").on(table.userId),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [profile.id],
      name: "handicap_calculation_queue_user_id_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
  ]
);

export const handicapCalculationQueueSchema = createSelectSchema(
  handicapCalculationQueue
);
export type HandicapCalculationQueue = InferSelectModel<
  typeof handicapCalculationQueue
>;

// Email preferences table - tracks user email notification preferences
export const emailPreferences = pgTable(
  "email_preferences",
  {
    id: uuid().defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().unique(),
    featureUpdates: boolean("feature_updates").default(true).notNull(),
    createdAt: timestamp("created_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updated_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [profile.id],
      name: "email_preferences_user_id_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    pgPolicy("Users can view their own email preferences", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
      using: sql`(auth.uid()::uuid = user_id)`,
    }),
    pgPolicy("Users can insert their own email preferences", {
      as: "permissive",
      for: "insert",
      to: ["authenticated"],
      withCheck: sql`(auth.uid()::uuid = user_id)`,
    }),
    pgPolicy("Users can update their own email preferences", {
      as: "permissive",
      for: "update",
      to: ["authenticated"],
      using: sql`(auth.uid()::uuid = user_id)`,
    }),
    pgPolicy("Users can delete their own email preferences", {
      as: "permissive",
      for: "delete",
      to: ["authenticated"],
      using: sql`(auth.uid()::uuid = user_id)`,
    }),
  ]
);

export const emailPreferencesSchema = createSelectSchema(emailPreferences);
export type EmailPreferences = InferSelectModel<typeof emailPreferences>;

// Pending email changes table - tracks email change verification workflow
export const pendingEmailChanges = pgTable(
  "pending_email_changes",
  {
    id: uuid().defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().unique(),
    oldEmail: text("old_email").notNull(),
    newEmail: text("new_email").notNull(),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    requestIp: text("request_ip"),
    verificationAttempts: integer("verification_attempts").default(0).notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [profile.id],
      name: "pending_email_changes_user_id_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    index("pending_email_changes_token_hash_idx").on(table.tokenHash),
    pgPolicy("Users can view their own pending email changes", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
      using: sql`(auth.uid()::uuid = user_id)`,
    }),
  ]
);

export const pendingEmailChangesSchema = createSelectSchema(pendingEmailChanges);
export type PendingEmailChange = InferSelectModel<typeof pendingEmailChanges>;
