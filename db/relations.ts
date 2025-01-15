import { relations } from "drizzle-orm/relations";
import {
  profile,
  course,
  teeInfo,
  hole,
  round,
  score,
  usersInAuth,
} from "./schema";

// Profile relationships
export const profileRelations = relations(profile, ({ one, many }) => ({
  user: one(usersInAuth, {
    fields: [profile.id],
    references: [usersInAuth.id],
  }),
  rounds: many(round),
}));

// Course relationships
export const courseRelations = relations(course, ({ many }) => ({
  tees: many(teeInfo),
  rounds: many(round),
}));

// TeeInfo relationships
export const teeInfoRelations = relations(teeInfo, ({ one, many }) => ({
  course: one(course, {
    fields: [teeInfo.courseId],
    references: [course.id],
  }),
  holes: many(hole),
  rounds: many(round),
}));

// Hole relationships
export const holeRelations = relations(hole, ({ one, many }) => ({
  tee: one(teeInfo, {
    fields: [hole.teeId],
    references: [teeInfo.id],
  }),
  scores: many(score),
}));

// Round relationships
export const roundRelations = relations(round, ({ one, many }) => ({
  user: one(profile, {
    fields: [round.userId],
    references: [profile.id],
  }),
  course: one(course, {
    fields: [round.courseId],
    references: [course.id],
  }),
  tee: one(teeInfo, {
    fields: [round.teeId],
    references: [teeInfo.id],
  }),
  scores: many(score),
}));

// Score relationships
export const scoreRelations = relations(score, ({ one }) => ({
  round: one(round, {
    fields: [score.roundId],
    references: [round.id],
  }),
  hole: one(hole, {
    fields: [score.holeId],
    references: [hole.id],
  }),
}));
