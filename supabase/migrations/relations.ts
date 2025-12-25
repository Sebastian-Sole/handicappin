import { relations } from "drizzle-orm/relations";
import { usersInAuth, profile, course, teeInfo, hole, round, score, stripeCustomers, webhookEvents, pendingLifetimePurchases, handicapCalculationQueue, emailPreferences, pendingEmailChanges } from "./schema";

export const profileRelations = relations(profile, ({one, many}) => ({
	usersInAuth: one(usersInAuth, {
		fields: [profile.id],
		references: [usersInAuth.id]
	}),
	rounds: many(round),
	scores: many(score),
	webhookEvents: many(webhookEvents),
	pendingLifetimePurchases: many(pendingLifetimePurchases),
	handicapCalculationQueues: many(handicapCalculationQueue),
	emailPreferences: many(emailPreferences),
	pendingEmailChanges: many(pendingEmailChanges),
}));

export const usersInAuthRelations = relations(usersInAuth, ({many}) => ({
	profiles: many(profile),
	stripeCustomers: many(stripeCustomers),
}));

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

export const holeRelations = relations(hole, ({one, many}) => ({
	teeInfo: one(teeInfo, {
		fields: [hole.teeId],
		references: [teeInfo.id]
	}),
	scores: many(score),
}));

export const roundRelations = relations(round, ({one, many}) => ({
	course: one(course, {
		fields: [round.courseId],
		references: [course.id]
	}),
	profile: one(profile, {
		fields: [round.userId],
		references: [profile.id]
	}),
	teeInfo: one(teeInfo, {
		fields: [round.teeId],
		references: [teeInfo.id]
	}),
	scores: many(score),
}));

export const scoreRelations = relations(score, ({one}) => ({
	round: one(round, {
		fields: [score.roundId],
		references: [round.id]
	}),
	hole: one(hole, {
		fields: [score.holeId],
		references: [hole.id]
	}),
	profile: one(profile, {
		fields: [score.userId],
		references: [profile.id]
	}),
}));

export const stripeCustomersRelations = relations(stripeCustomers, ({one}) => ({
	usersInAuth: one(usersInAuth, {
		fields: [stripeCustomers.userId],
		references: [usersInAuth.id]
	}),
}));

export const webhookEventsRelations = relations(webhookEvents, ({one}) => ({
	profile: one(profile, {
		fields: [webhookEvents.userId],
		references: [profile.id]
	}),
}));

export const pendingLifetimePurchasesRelations = relations(pendingLifetimePurchases, ({one}) => ({
	profile: one(profile, {
		fields: [pendingLifetimePurchases.userId],
		references: [profile.id]
	}),
}));

export const handicapCalculationQueueRelations = relations(handicapCalculationQueue, ({one}) => ({
	profile: one(profile, {
		fields: [handicapCalculationQueue.userId],
		references: [profile.id]
	}),
}));

export const emailPreferencesRelations = relations(emailPreferences, ({one}) => ({
	profile: one(profile, {
		fields: [emailPreferences.userId],
		references: [profile.id]
	}),
}));

export const pendingEmailChangesRelations = relations(pendingEmailChanges, ({one}) => ({
	profile: one(profile, {
		fields: [pendingEmailChanges.userId],
		references: [profile.id]
	}),
}));