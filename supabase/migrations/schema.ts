import { pgTable, uniqueIndex, foreignKey, pgPolicy, uuid, text, doublePrecision, boolean, serial, integer, varchar, timestamp } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const profile = pgTable("Profile", {
	id: uuid().primaryKey().notNull(),
	email: text().notNull(),
	name: text(),
	handicapIndex: doublePrecision().notNull(),
	verified: boolean().default(false).notNull(),
}, (table) => [
	uniqueIndex("Profile_email_key").using("btree", table.email.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.id],
			foreignColumns: [users.id],
			name: "Profile_id_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	pgPolicy("Allow profile updates for authed users", { as: "permissive", for: "update", to: ["public"], using: sql`(auth.uid() = id)` }),
	pgPolicy("Enable delete for users based on user_id", { as: "permissive", for: "delete", to: ["public"] }),
	pgPolicy("Enable insert for authenticated users only", { as: "permissive", for: "insert", to: ["authenticated"] }),
	pgPolicy("Enable users to view their own data only", { as: "permissive", for: "select", to: ["authenticated"] }),
]);

export const hole = pgTable("Hole", {
	id: serial().primaryKey().notNull(),
	hcp: integer().notNull(),
	strokes: integer().notNull(),
	roundId: integer().notNull(),
	holeNumber: integer().notNull(),
	par: integer().notNull(),
	userId: uuid().notNull(),
	hcpStrokes: integer().default(0).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.roundId],
			foreignColumns: [round.id],
			name: "Hole_roundId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [profile.id],
			name: "Hole_userId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	pgPolicy("Enable insert for users based on userId", { as: "permissive", for: "insert", to: ["authenticated"], withCheck: sql`(( SELECT auth.uid() AS uid) = "userId")`  }),
	pgPolicy("Enable users to view their own data only", { as: "permissive", for: "select", to: ["authenticated"] }),
]);

export const prismaMigrations = pgTable("_prisma_migrations", {
	id: varchar({ length: 36 }).primaryKey().notNull(),
	checksum: varchar({ length: 64 }).notNull(),
	finishedAt: timestamp("finished_at", { withTimezone: true, mode: 'string' }),
	migrationName: varchar("migration_name", { length: 255 }).notNull(),
	logs: text(),
	rolledBackAt: timestamp("rolled_back_at", { withTimezone: true, mode: 'string' }),
	startedAt: timestamp("started_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	appliedStepsCount: integer("applied_steps_count").default(0).notNull(),
});

export const round = pgTable("Round", {
	id: serial().primaryKey().notNull(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	courseId: integer().notNull(),
	teeTime: timestamp({ precision: 3, mode: 'string' }).notNull(),
	userId: uuid().notNull(),
	adjustedGrossScore: integer().notNull(),
	existingHandicapIndex: doublePrecision().notNull(),
	scoreDifferential: doublePrecision().notNull(),
	totalStrokes: integer().notNull(),
	notes: text(),
	parPlayed: integer().notNull(),
	updatedHandicapIndex: doublePrecision().default(0).notNull(),
	exceptionalScoreAdjustment: integer().default(0).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.courseId],
			foreignColumns: [course.id],
			name: "Round_courseId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [profile.id],
			name: "Round_userId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	pgPolicy("Enable insert for users based on userId", { as: "permissive", for: "insert", to: ["authenticated"], withCheck: sql`(( SELECT auth.uid() AS uid) = "userId")`  }),
	pgPolicy("Enable users to view their own data only", { as: "permissive", for: "select", to: ["authenticated"] }),
]);

export const course = pgTable("Course", {
	id: serial().primaryKey().notNull(),
	name: text().notNull(),
	courseRating: doublePrecision().notNull(),
	slopeRating: doublePrecision().notNull(),
	eighteenHolePar: integer().notNull(),
	nineHolePar: integer().notNull(),
}, (table) => [
	uniqueIndex("Course_name_key").using("btree", table.name.asc().nullsLast().op("text_ops")),
	pgPolicy("Enable insert for authenticated users only", { as: "permissive", for: "insert", to: ["authenticated"], withCheck: sql`true`  }),
	pgPolicy("Enable read access for all users", { as: "permissive", for: "select", to: ["authenticated"] }),
]);
