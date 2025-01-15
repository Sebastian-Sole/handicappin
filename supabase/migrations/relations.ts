import { relations } from "drizzle-orm/relations";
import { course, teeInfo, hole, score, round, usersInAuth, profile } from "./schema";

export const teeInfoRelations = relations(teeInfo, ({one, many}) => ({
	course: one(course, {
		fields: [teeInfo.courseId],
		references: [course.id]
	}),
	holes: many(hole),
	rounds: many(round),
}));

export const courseRelations = relations(course, ({many}) => ({
	teeInfos: many(teeInfo),
	rounds: many(round),
}));

export const scoreRelations = relations(score, ({one}) => ({
	hole: one(hole, {
		fields: [score.holeId],
		references: [hole.id]
	}),
	round: one(round, {
		fields: [score.roundId],
		references: [round.id]
	}),
}));

export const holeRelations = relations(hole, ({one, many}) => ({
	scores: many(score),
	teeInfo: one(teeInfo, {
		fields: [hole.teeId],
		references: [teeInfo.id]
	}),
}));

export const roundRelations = relations(round, ({one, many}) => ({
	scores: many(score),
	course: one(course, {
		fields: [round.courseId],
		references: [course.id]
	}),
	teeInfo: one(teeInfo, {
		fields: [round.teeId],
		references: [teeInfo.id]
	}),
	profile: one(profile, {
		fields: [round.userId],
		references: [profile.id]
	}),
}));

export const profileRelations = relations(profile, ({one, many}) => ({
	usersInAuth: one(usersInAuth, {
		fields: [profile.id],
		references: [usersInAuth.id]
	}),
	rounds: many(round),
}));

export const usersInAuthRelations = relations(usersInAuth, ({many}) => ({
	profiles: many(profile),
}));