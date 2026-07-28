/**
 * Framework-free scorecard service (subplan 002).
 *
 * Adapters (tRPC today, `/v1` REST in subplan 005) import from this barrel;
 * nothing in `server/services/scorecard/` may import Next.js, tRPC, Sentry,
 * or `@/env` (enforced in `eslint.config.mjs`).
 */
export {
  submitScorecard,
  type AdminSubmissionNotification,
  type OverLimitPolicy,
  type ScorecardAnalytics,
  type ScorecardDb,
  type ScorecardLogger,
  type ScorecardSubmissionSummary,
  type SubmitScorecardDeps,
} from "./submit-scorecard";
export {
  CourseResolutionError,
  PlanNotSelectedError,
  RoundLimitRaceError,
  RoundLimitReachedError,
  SelfSubmissionError,
} from "./errors";
