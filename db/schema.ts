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
    handicapIndex: decimal<"number">().notNull().default(54),
    verified: boolean().default(false).notNull(),
    initialHandicapIndex: decimal<"number">().notNull().default(54),
    createdAt: timestamp()
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
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
export type Profile = z.infer<typeof profileSchema>;

export const course = pgTable(
  "course",
  {
    id: serial().primaryKey().notNull(),
    name: text().notNull(),
    approvalStatus: text().default("pending").notNull(),
    country: text().default("Scotland").notNull(),
    website: text(),
  },
  (table) => [
    uniqueIndex("course_name_key").using(
      "btree",
      table.name.asc().nullsLast().op("text_ops")
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
export type Course = z.infer<typeof courseSchema>;

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
export type TeeInfo = z.infer<typeof teeInfoSchema>;

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
export type Hole = z.infer<typeof holeSchema>;

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
export type Round = z.infer<typeof roundSchema>;

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
export type Score = z.infer<typeof scoreSchema>;
