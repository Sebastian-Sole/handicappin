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

const authSchema = pgSchema("auth");
export const usersInAuth = authSchema.table("users", {
  id: uuid("id").primaryKey(),
});

export const profile = pgTable(
  "Profile",
  {
    id: uuid().primaryKey().notNull(),
    email: text().notNull(),
    name: text(),
    handicapIndex: doublePrecision().notNull(),
    verified: boolean().default(false).notNull(),
  },
  (table) => [
    uniqueIndex("Profile_email_key").using(
      "btree",
      table.email.asc().nullsLast().op("text_ops")
    ),
    foreignKey({
      columns: [table.id],
      foreignColumns: [usersInAuth.id],
      name: "Profile_id_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    pgPolicy("Allow profile updates for authed users", {
      as: "permissive",
      for: "update",
      to: ["public"],
      using: sql`(auth.uid() = id)`,
    }),
    pgPolicy("Enable delete for users based on their own user_id", {
      as: "permissive",
      for: "delete",
      to: ["public"],
      using: sql`(auth.uid() = id)`,
    }),
    pgPolicy("Enable insert for authenticated users only", {
      as: "permissive",
      for: "insert",
      to: ["authenticated"],
      withCheck: sql`true`,
    }),
    pgPolicy("Enable users to view their own data only", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
      using: sql`(auth.uid() = id)`,
    }),
  ]
);

export const course = pgTable(
  "Course",
  {
    id: serial().primaryKey().notNull(),
    name: text().notNull(),
    isApproved: boolean().default(false).notNull(),
  },
  (table) => [
    uniqueIndex("Course_name_key").using(
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

export const teeInfo = pgTable(
  "TeeInfo",
  {
    id: serial().primaryKey().notNull(),
    courseId: integer().notNull(),
    name: text().notNull(),
    gender: text().notNull(),

    /* Number of Holes: 9 or 18 */
    numberOfHoles: integer().notNull(), // 9 or 18

    /* Course & Slope Ratings */
    courseRating18: doublePrecision().notNull(),
    slopeRating18: integer().notNull(),
    courseRatingFront9: doublePrecision().notNull(),
    slopeRatingFront9: integer().notNull(),
    courseRatingBack9: doublePrecision().notNull(),
    slopeRatingBack9: integer().notNull(),

    /* Auto-Calculated Values */
    outPar: integer().notNull(),
    inPar: integer(), // NULL if 9 holes
    totalPar: integer().notNull(),
    outDistance: integer().notNull(),
    inDistance: integer(),
    totalDistance: integer().notNull(),

    isApproved: boolean().default(false).notNull(),
    isArchived: boolean().default(false).notNull(),
    version: integer().default(1).notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.courseId],
      foreignColumns: [course.id],
      name: "TeeInfo_courseId_fkey",
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

export const hole = pgTable(
  "Hole",
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
      name: "Hole_teeId_fkey",
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

export const round = pgTable(
  "Round",
  {
    id: serial().primaryKey().notNull(),
    teeTime: timestamp().notNull(),
    courseId: integer().notNull(),
    userId: uuid().notNull(),
    teeId: integer().notNull(),
    existingHandicapIndex: doublePrecision().notNull(),
    updatedHandicapIndex: doublePrecision().default(0).notNull(),
    scoreDifferential: doublePrecision().notNull(),
    totalStrokes: integer().notNull(),
    adjustedGrossScore: integer().notNull(),
    createdAt: timestamp()
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    parPlayed: integer().notNull(),
    notes: text(),
    exceptionalScoreAdjustment: integer().default(0).notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.courseId],
      foreignColumns: [course.id],
      name: "Round_courseId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [profile.id],
      name: "Round_userId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    foreignKey({
      columns: [table.teeId],
      foreignColumns: [teeInfo.id],
      name: "Round_teeId_fkey",
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

export const score = pgTable(
  "Score",
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
      name: "Score_roundId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    foreignKey({
      columns: [table.holeId],
      foreignColumns: [hole.id],
      name: "Score_holeId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [profile.id],
      name: "Score_userId_fkey",
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
