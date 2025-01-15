import { pgTable, foreignKey, pgPolicy, serial, integer, text, doublePrecision, boolean, uniqueIndex, uuid, varchar, timestamp } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const teeInfo = pgTable("TeeInfo", {
	id: serial().primaryKey().notNull(),
	courseId: integer().notNull(),
	name: text().notNull(),
	gender: text().notNull(),
	courseRating: doublePrecision().notNull(),
	slopeRating: doublePrecision().notNull(),
	totalPar: integer().notNull(),
	outPar: integer().notNull(),
	inPar: integer().notNull(),
	totalDistance: integer().notNull(),
	outDistance: integer().notNull(),
	inDistance: integer().notNull(),
	distanceMeasurement: text().notNull(),
	isApproved: boolean().default(false).notNull(),
	isArchived: boolean().default(false).notNull(),
	version: integer().default(1).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.courseId],
			foreignColumns: [course.id],
			name: "TeeInfo_courseId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	pgPolicy("Enable insert for authenticated users only", { as: "permissive", for: "insert", to: ["authenticated"] }),
	pgPolicy("Enable read access for all users", { as: "permissive", for: "select", to: ["authenticated"] }),
]);

export const score = pgTable("Score", {
	id: serial().primaryKey().notNull(),
	roundId: integer().notNull(),
	holeId: integer().notNull(),
	strokes: integer().notNull(),
	hcpStrokes: integer().default(0).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.holeId],
			foreignColumns: [hole.id],
			name: "Score_holeId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.roundId],
			foreignColumns: [round.id],
			name: "Score_roundId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	pgPolicy("Enable insert for users based on userId", { as: "permissive", for: "insert", to: ["authenticated"] }),
	pgPolicy("Enable users to view their own data only", { as: "permissive", for: "select", to: ["authenticated"] }),
]);

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
	pgPolicy("Enable insert for authenticated users only", { as: "permissive", for: "insert", to: ["authenticated"] }),
	pgPolicy("Enable users to view their own data only", { as: "permissive", for: "select", to: ["authenticated"] }),
	pgPolicy("Enable delete for users based on their own user_id", { as: "permissive", for: "delete", to: ["public"] }),
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

export const hole = pgTable("Hole", {
	id: serial().primaryKey().notNull(),
	hcp: integer().notNull(),
	holeNumber: integer().notNull(),
	par: integer().notNull(),
	teeId: integer().notNull(),
	length: integer().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.teeId],
			foreignColumns: [teeInfo.id],
			name: "Hole_teeId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	pgPolicy("Enable insert for authenticated users only", { as: "permissive", for: "insert", to: ["authenticated"] }),
	pgPolicy("Enable read access for all users", { as: "permissive", for: "select", to: ["authenticated"] }),
]);

export const round = pgTable("Round", {
	id: serial().primaryKey().notNull(),
	createdAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	courseId: integer().notNull(),
	teeTime: timestamp({ mode: 'string' }).notNull(),
	userId: uuid().notNull(),
	adjustedGrossScore: integer().notNull(),
	existingHandicapIndex: doublePrecision().notNull(),
	scoreDifferential: doublePrecision().notNull(),
	totalStrokes: integer().notNull(),
	notes: text(),
	parPlayed: integer().notNull(),
	updatedHandicapIndex: doublePrecision().default(0).notNull(),
	exceptionalScoreAdjustment: integer().default(0).notNull(),
	teeId: integer().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.courseId],
			foreignColumns: [course.id],
			name: "Round_courseId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.teeId],
			foreignColumns: [teeInfo.id],
			name: "Round_teeId_fkey"
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
	isApproved: boolean().default(false).notNull(),
}, (table) => [
	uniqueIndex("Course_name_key").using("btree", table.name.asc().nullsLast().op("text_ops")),
	pgPolicy("Enable insert for authenticated users only", { as: "permissive", for: "insert", to: ["authenticated"], withCheck: sql`true`  }),
	pgPolicy("Enable read access for all users", { as: "permissive", for: "select", to: ["authenticated"] }),
]);
