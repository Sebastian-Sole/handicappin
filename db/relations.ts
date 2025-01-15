import { relations } from "drizzle-orm/relations";
import { usersInAuth, profile, round, hole, course } from "./schema";

export const profileRelations = relations(profile, ({one, many}) => ({
	usersInAuth: one(usersInAuth, {
		fields: [profile.id],
		references: [usersInAuth.id]
	}),
	holes: many(hole),
	rounds: many(round),
}));

export const usersInAuthRelations = relations(usersInAuth, ({many}) => ({
	profiles: many(profile),
}));

export const holeRelations = relations(hole, ({one}) => ({
	round: one(round, {
		fields: [hole.roundId],
		references: [round.id]
	}),
	profile: one(profile, {
		fields: [hole.userId],
		references: [profile.id]
	}),
}));

export const roundRelations = relations(round, ({one, many}) => ({
	holes: many(hole),
	course: one(course, {
		fields: [round.courseId],
		references: [course.id]
	}),
	profile: one(profile, {
		fields: [round.userId],
		references: [profile.id]
	}),
}));

export const courseRelations = relations(course, ({many}) => ({
	rounds: many(round),
}));