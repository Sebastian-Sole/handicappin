import { pgTable, index, uniqueIndex, foreignKey, pgPolicy, check, uuid, text, numeric, boolean, timestamp, bigint, integer, serial, unique } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const profile = pgTable("profile", {
	id: uuid().primaryKey().notNull(),
	email: text().notNull(),
	name: text(),
	handicapIndex: numeric().default('54').notNull(),
	verified: boolean().default(false).notNull(),
	initialHandicapIndex: numeric().default('54').notNull(),
	createdAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	planSelected: text("plan_selected"),
	planSelectedAt: timestamp("plan_selected_at", { withTimezone: true, mode: 'string' }),
	subscriptionStatus: text("subscription_status"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	currentPeriodEnd: bigint("current_period_end", { mode: "number" }),
	cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false).notNull(),
	billingVersion: integer("billing_version").default(1).notNull(),
}, (table) => [
	index("idx_profile_plan_selected").using("btree", table.planSelected.asc().nullsLast().op("text_ops")),
	index("idx_profile_subscription_status").using("btree", table.subscriptionStatus.asc().nullsLast().op("text_ops")),
	uniqueIndex("profile_email_key").using("btree", table.email.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.id],
			foreignColumns: [users.id],
			name: "profile_id_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	pgPolicy("Auth admin can read profiles for JWT hook", { as: "permissive", for: "select", to: ["supabase_auth_admin"], using: sql`true` }),
	pgPolicy("Users can update their own profile", { as: "permissive", for: "update", to: ["authenticated"] }),
	pgPolicy("Users can delete their own profile", { as: "permissive", for: "delete", to: ["authenticated"] }),
	pgPolicy("Users can insert their own profile", { as: "permissive", for: "insert", to: ["authenticated"] }),
	pgPolicy("Users can view their own profile", { as: "permissive", for: "select", to: ["authenticated"] }),
	check("profile_plan_selected_check", sql`plan_selected = ANY (ARRAY['free'::text, 'premium'::text, 'unlimited'::text, 'lifetime'::text])`),
	check("profile_subscription_status_check", sql`subscription_status = ANY (ARRAY['active'::text, 'trialing'::text, 'past_due'::text, 'canceled'::text, 'paused'::text, 'incomplete'::text, 'incomplete_expired'::text, 'unpaid'::text])`),
]);

export const teeInfo = pgTable("teeInfo", {
	id: serial().primaryKey().notNull(),
	courseId: integer().notNull(),
	name: text().notNull(),
	gender: text().notNull(),
	courseRating18: numeric().notNull(),
	slopeRating18: integer().notNull(),
	courseRatingFront9: numeric().notNull(),
	slopeRatingFront9: integer().notNull(),
	courseRatingBack9: numeric().notNull(),
	slopeRatingBack9: integer().notNull(),
	outPar: integer().notNull(),
	inPar: integer().notNull(),
	totalPar: integer().notNull(),
	outDistance: integer().notNull(),
	inDistance: integer().notNull(),
	totalDistance: integer().notNull(),
	distanceMeasurement: text().default('yards').notNull(),
	approvalStatus: text().default('pending').notNull(),
	isArchived: boolean().default(false).notNull(),
	version: integer().default(1).notNull(),
}, (table) => [
	uniqueIndex("teeInfo_courseId_name_gender_key").using("btree", table.courseId.asc().nullsLast().op("text_ops"), table.name.asc().nullsLast().op("int4_ops"), table.gender.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.courseId],
			foreignColumns: [course.id],
			name: "teeInfo_courseId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	pgPolicy("Authenticated users can view tee info", { as: "permissive", for: "select", to: ["authenticated"], using: sql`true` }),
]);

export const hole = pgTable("hole", {
	id: serial().primaryKey().notNull(),
	teeId: integer().notNull(),
	holeNumber: integer().notNull(),
	par: integer().notNull(),
	distance: integer().notNull(),
	hcp: integer().notNull(),
}, (table) => [
	uniqueIndex("hole_teeId_holeNumber_key").using("btree", table.teeId.asc().nullsLast().op("int4_ops"), table.holeNumber.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.teeId],
			foreignColumns: [teeInfo.id],
			name: "hole_teeId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	pgPolicy("Authenticated users can view holes", { as: "permissive", for: "select", to: ["authenticated"], using: sql`true` }),
]);

export const course = pgTable("course", {
	id: serial().primaryKey().notNull(),
	name: text().notNull(),
	approvalStatus: text().default('pending').notNull(),
	country: text().default('Scotland').notNull(),
	city: text().default('St. Andrews').notNull(),
	website: text(),
}, (table) => [
	uniqueIndex("course_name_country_city_key").using("btree", table.name.asc().nullsLast().op("text_ops"), table.country.asc().nullsLast().op("text_ops"), table.city.asc().nullsLast().op("text_ops")),
	pgPolicy("Authenticated users can view courses", { as: "permissive", for: "select", to: ["authenticated"], using: sql`true` }),
]);

export const round = pgTable("round", {
	id: serial().primaryKey().notNull(),
	userId: uuid().notNull(),
	courseId: integer().notNull(),
	teeId: integer().notNull(),
	teeTime: timestamp({ mode: 'string' }).notNull(),
	totalStrokes: integer().notNull(),
	parPlayed: integer().notNull(),
	adjustedGrossScore: integer().notNull(),
	adjustedPlayedScore: integer().notNull(),
	courseHandicap: integer().notNull(),
	scoreDifferential: numeric().notNull(),
	existingHandicapIndex: numeric().notNull(),
	updatedHandicapIndex: numeric().notNull(),
	exceptionalScoreAdjustment: numeric().default('0').notNull(),
	notes: text(),
	approvalStatus: text().default('pending').notNull(),
	createdAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	index("idx_round_user_id").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.courseId],
			foreignColumns: [course.id],
			name: "round_courseId_fkey"
		}).onUpdate("cascade").onDelete("restrict"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [profile.id],
			name: "round_userId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.teeId],
			foreignColumns: [teeInfo.id],
			name: "round_teeId_fkey"
		}).onUpdate("cascade").onDelete("restrict"),
	pgPolicy("Users can delete their own rounds", { as: "permissive", for: "delete", to: ["authenticated"], using: sql`(auth.uid() = "userId")` }),
	pgPolicy("Users can update their own rounds", { as: "permissive", for: "update", to: ["authenticated"] }),
	pgPolicy("Users can insert their own rounds", { as: "permissive", for: "insert", to: ["authenticated"] }),
	pgPolicy("Users can view their own rounds", { as: "permissive", for: "select", to: ["authenticated"] }),
]);

export const score = pgTable("score", {
	id: serial().primaryKey().notNull(),
	userId: uuid().notNull(),
	roundId: integer().notNull(),
	holeId: integer().notNull(),
	strokes: integer().notNull(),
	hcpStrokes: integer().default(0).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.roundId],
			foreignColumns: [round.id],
			name: "score_roundId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.holeId],
			foreignColumns: [hole.id],
			name: "score_holeId_fkey"
		}).onUpdate("cascade").onDelete("restrict"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [profile.id],
			name: "score_userId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	pgPolicy("Users can delete their own scores", { as: "permissive", for: "delete", to: ["authenticated"], using: sql`(auth.uid() = "userId")` }),
	pgPolicy("Users can update their own scores", { as: "permissive", for: "update", to: ["authenticated"] }),
	pgPolicy("Users can insert their own scores", { as: "permissive", for: "insert", to: ["authenticated"] }),
	pgPolicy("Users can view their own scores", { as: "permissive", for: "select", to: ["authenticated"] }),
]);

export const stripeCustomers = pgTable("stripe_customers", {
	userId: uuid("user_id").primaryKey().notNull(),
	stripeCustomerId: text("stripe_customer_id").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "stripe_customers_user_id_users_id_fk"
		}).onDelete("cascade"),
	unique("stripe_customers_stripe_customer_id_unique").on(table.stripeCustomerId),
	pgPolicy("Users can view their own stripe customer", { as: "permissive", for: "select", to: ["authenticated"], using: sql`(auth.uid() = user_id)` }),
]);

export const webhookEvents = pgTable("webhook_events", {
	eventId: text("event_id").primaryKey().notNull(),
	eventType: text("event_type").notNull(),
	processedAt: timestamp("processed_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	status: text().notNull(),
	errorMessage: text("error_message"),
	retryCount: integer("retry_count").default(0).notNull(),
	userId: uuid("user_id"),
}, (table) => [
	index("idx_webhook_events_event_type").using("btree", table.eventType.asc().nullsLast().op("text_ops")),
	index("idx_webhook_events_processed_at").using("btree", table.processedAt.asc().nullsLast().op("timestamp_ops")),
	index("idx_webhook_events_user_id").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [profile.id],
			name: "webhook_events_user_id_fkey"
		}).onUpdate("cascade").onDelete("set null"),
]);

export const pendingLifetimePurchases = pgTable("pending_lifetime_purchases", {
	id: serial().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	checkoutSessionId: text("checkout_session_id").notNull(),
	paymentIntentId: text("payment_intent_id"),
	priceId: text("price_id").notNull(),
	plan: text().notNull(),
	status: text().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	index("idx_pending_lifetime_payment_intent").using("btree", table.paymentIntentId.asc().nullsLast().op("text_ops")),
	index("idx_pending_lifetime_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	index("idx_pending_lifetime_user").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [profile.id],
			name: "pending_lifetime_purchases_user_id_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	unique("pending_lifetime_purchases_checkout_session_id_unique").on(table.checkoutSessionId),
	pgPolicy("Users can view their own pending purchases", { as: "permissive", for: "select", to: ["authenticated"], using: sql`(auth.uid() = user_id)` }),
]);

export const handicapCalculationQueue = pgTable("handicap_calculation_queue", {
	id: serial().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	eventType: text("event_type").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	lastUpdated: timestamp("last_updated", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	status: text().default('pending').notNull(),
	attempts: integer().default(0).notNull(),
	errorMessage: text("error_message"),
}, (table) => [
	index("idx_handicap_queue_status_created").using("btree", table.status.asc().nullsLast().op("text_ops"), table.createdAt.asc().nullsLast().op("text_ops")),
	index("idx_handicap_queue_user_id").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [profile.id],
			name: "handicap_calculation_queue_user_id_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	unique("handicap_calculation_queue_user_id_unique").on(table.userId),
]);

export const emailPreferences = pgTable("email_preferences", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	featureUpdates: boolean("feature_updates").default(true).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [profile.id],
			name: "email_preferences_user_id_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	unique("email_preferences_user_id_unique").on(table.userId),
	pgPolicy("Users can delete their own email preferences", { as: "permissive", for: "delete", to: ["authenticated"], using: sql`(auth.uid() = user_id)` }),
	pgPolicy("Users can update their own email preferences", { as: "permissive", for: "update", to: ["authenticated"] }),
	pgPolicy("Users can insert their own email preferences", { as: "permissive", for: "insert", to: ["authenticated"] }),
	pgPolicy("Users can view their own email preferences", { as: "permissive", for: "select", to: ["authenticated"] }),
]);

export const pendingEmailChanges = pgTable("pending_email_changes", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	oldEmail: text("old_email").notNull(),
	newEmail: text("new_email").notNull(),
	tokenHash: text("token_hash").notNull(),
	expiresAt: timestamp("expires_at", { mode: 'string' }).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	requestIp: text("request_ip"),
	verificationAttempts: integer("verification_attempts").default(0).notNull(),
	cancelToken: text("cancel_token"),
}, (table) => [
	index("pending_email_changes_cancel_token_idx").using("btree", table.cancelToken.asc().nullsLast().op("text_ops")),
	index("pending_email_changes_token_hash_idx").using("btree", table.tokenHash.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [profile.id],
			name: "pending_email_changes_user_id_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	unique("pending_email_changes_user_id_unique").on(table.userId),
	pgPolicy("Users can view their own pending email changes", { as: "permissive", for: "select", to: ["authenticated"], using: sql`(auth.uid() = user_id)` }),
]);

export const otpVerifications = pgTable("otp_verifications", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id"),
	email: text().notNull(),
	otpHash: text("otp_hash").notNull(),
	otpType: text("otp_type").notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }).notNull(),
	verified: boolean().default(false).notNull(),
	verificationAttempts: integer("verification_attempts").default(0).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	verifiedAt: timestamp("verified_at", { withTimezone: true, mode: 'string' }),
	requestIp: text("request_ip"),
	metadata: text(),
}, (table) => [
	index("otp_verifications_email_type_idx").using("btree", table.email.asc().nullsLast().op("text_ops"), table.otpType.asc().nullsLast().op("text_ops")),
	index("otp_verifications_expires_at_idx").using("btree", table.expiresAt.asc().nullsLast().op("timestamptz_ops")),
	index("otp_verifications_user_id_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	pgPolicy("No direct access to OTP verifications", { as: "permissive", for: "all", to: ["public"], using: sql`false` }),
	check("otp_verifications_otp_type_check", sql`otp_type = ANY (ARRAY['signup'::text, 'email_change'::text, 'password_reset'::text])`),
]);
