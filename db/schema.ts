import {
  pgTable,
  uniqueIndex,
  foreignKey,
  pgPolicy,
  uuid,
  text,
  doublePrecision,
  boolean,
  serial,
  integer,
  timestamp,
  pgSchema,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";
const authSchema = pgSchema("auth");
export const usersInAuth = authSchema.table("users", {
  id: uuid("id").primaryKey(),
});

export const profile = pgTable(
  "profile",
  {
    id: uuid().primaryKey().notNull(),
    email: text().notNull(),
    name: text(),
    handicapIndex: doublePrecision().notNull(),
    verified: boolean().default(false).notNull(),
  },
  (table) => [
    uniqueIndex("profile_email_key").using(
      "btree",
      table.email.asc().nullsLast().op("text_ops")
    ),
    foreignKey({
      columns: [table.id],
      foreignColumns: [usersInAuth.id],
      name: "profile_id_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    // SELECT: only allow a user to read the row whose id matches their JWT
    pgPolicy("Users can select their own profile", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
      using: sql`(auth.uid()::uuid = id)`,
    }),

    // UPDATE: only allow a user to update their own row
    pgPolicy("Users can update their own profile", {
      as: "permissive",
      for: "update",
      to: ["authenticated"],
      using: sql`(auth.uid()::uuid = id)`,
    }),

    // INSERT: only allow a user to INSERT *their* profile
    // (so that malicious JWTs can’t insert rows under someone else’s UUID)
    pgPolicy("Users can insert their own profile", {
      as: "permissive",
      for: "insert",
      to: ["authenticated"],
      withCheck: sql`(auth.uid()::uuid = id)`,
    }),

    // DELETE: if you want users to be able to delete their own profile
    pgPolicy("Users can delete their own profile", {
      as: "permissive",
      for: "delete",
      to: ["authenticated"],
      using: sql`(auth.uid()::uuid = id)`,
    }),
  ]
);

export const profileSchema = createSelectSchema(profile);
export type Profile = z.infer<typeof profileSchema>;

export const course = pgTable(
  "course",
  {
    id: serial().primaryKey().notNull(),
    name: text().notNull(),
    approvalStatus: text().default("pending").notNull(),
  },
  (table) => [
    uniqueIndex("course_name_key").using(
      "btree",
      table.name.asc().nullsLast().op("text_ops")
    ),
    pgPolicy("Enable insert for authenticated users only", {
      as: "permissive",
      for: "insert",
      to: ["authenticated"],
      withCheck: sql`true`,
    }),
    pgPolicy("Enable read access for all users", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
    }),
  ]
);

export const courseSchema = createSelectSchema(course);
export type Course = z.infer<typeof courseSchema>;

export const teeInfo = pgTable(
  "teeInfo",
  {
    id: serial().primaryKey().notNull(),
    courseId: integer().notNull(),
    name: text().notNull(),
    gender: text().notNull(),

    /* Course & Slope Ratings */
    courseRating18: doublePrecision().notNull(),
    slopeRating18: integer().notNull(),
    courseRatingFront9: doublePrecision().notNull(),
    slopeRatingFront9: integer().notNull(),
    courseRatingBack9: doublePrecision().notNull(),
    slopeRatingBack9: integer().notNull(),

    /* Auto-Calculated Values */
    outPar: integer().notNull(),
    inPar: integer().notNull(),
    totalPar: integer().notNull(),
    outDistance: integer().notNull(),
    inDistance: integer().notNull(),
    totalDistance: integer().notNull(),
    distanceMeasurement: text().notNull().default("meters"),

    approvalStatus: text().default("pending").notNull(),
    isArchived: boolean().default(false).notNull(),
    version: integer().default(1).notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.courseId],
      foreignColumns: [course.id],
      name: "teeInfo_courseId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    pgPolicy("Enable insert for authenticated users only", {
      as: "permissive",
      for: "insert",
      to: ["authenticated"],
      withCheck: sql`true`,
    }),
    pgPolicy("Enable read access for all users", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
    }),
  ]
);

export const teeInfoSchema = createSelectSchema(teeInfo);
export type TeeInfo = z.infer<typeof teeInfoSchema>;

export const hole = pgTable(
  "hole",
  {
    id: serial().primaryKey().notNull(),
    teeId: integer().notNull(),
    holeNumber: integer().notNull(),
    par: integer().notNull(),
    hcp: integer().notNull(),
    distance: integer().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.teeId],
      foreignColumns: [teeInfo.id],
      name: "hole_teeId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    pgPolicy("Enable insert for authenticated users only", {
      as: "permissive",
      for: "insert",
      to: ["authenticated"],
      withCheck: sql`true`,
    }),
    pgPolicy("Enable read access for all users", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
    }),
  ]
);

export const holeSchema = createSelectSchema(hole);
export type Hole = z.infer<typeof holeSchema>;

export const round = pgTable(
  "round",
  {
    id: serial().primaryKey().notNull(),
    teeTime: timestamp().notNull(),
    courseId: integer().notNull(),
    userId: uuid().notNull(),
    teeId: integer().notNull(),
    existingHandicapIndex: doublePrecision().notNull(),
    updatedHandicapIndex: doublePrecision().default(54).notNull(),
    scoreDifferential: doublePrecision().notNull(),
    totalStrokes: integer().notNull(),
    adjustedGrossScore: integer().notNull(),
    adjustedPlayedScore: integer().notNull(),
    createdAt: timestamp()
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    parPlayed: integer().notNull(),
    notes: text(),
    exceptionalScoreAdjustment: integer().default(0).notNull(),
    courseHandicap: integer().notNull(),
    approvalStatus: text().default("pending").notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.courseId],
      foreignColumns: [course.id],
      name: "round_courseId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
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
      .onDelete("cascade"),
    pgPolicy("Enable insert for users based on userId", {
      as: "permissive",
      for: "insert",
      to: ["authenticated"],
      withCheck: sql`(( SELECT auth.uid()) = "userId")`,
    }),
    pgPolicy("Enable users to view their own data only", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
      using: sql`(( SELECT auth.uid()) = "userId")`,
    }),
  ]
);

export const roundSchema = createSelectSchema(round);
export type Round = z.infer<typeof roundSchema>;

export const score = pgTable(
  "score",
  {
    id: serial().primaryKey().notNull(),
    roundId: integer().notNull(),
    holeId: integer().notNull(),
    strokes: integer().notNull(),
    hcpStrokes: integer().default(0).notNull(),
    userId: uuid().notNull(),
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
      .onDelete("cascade"),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [profile.id],
      name: "score_userId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    pgPolicy("Enable insert for users based on userId", {
      as: "permissive",
      for: "insert",
      to: ["authenticated"],
      withCheck: sql`(( SELECT auth.uid()) = "userId")`,
    }),
    pgPolicy("Enable users to view their own data only", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
      using: sql`(auth.uid() = "userId")`,
    }),
  ]
);

export const scoreSchema = createSelectSchema(score);
export type Score = z.infer<typeof scoreSchema>;
