/**
 * Verification harness — central config.
 *
 * Ported from the ks-digital reference harness (apps/app/verification) and
 * adapted to handicappin's monorepo. Local-first, $0 cloud: everything here is
 * a knob the operator can re-tune live. The caps/cost numbers are the seeds
 * MEASURED in the ks calibration spike — refine them from this repo's own
 * loop-control records once the first screen converges.
 *
 * IS:    the single source of truth for screens, caps, denylist, paths, cost,
 *        and the vision-judge model id.
 * IS NOT: any verdict logic — that lives in gates/, judge/, loop/.
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const HARNESS_DIR = dirname(fileURLToPath(import.meta.url));
export const APP_DIR = join(HARNESS_DIR, '..');
export const MONOREPO_ROOT = join(APP_DIR, '..', '..');
/** Frozen per-screen rubrics live with the harness (no docs/ fidelity dir here). */
export const RUBRICS_DIR = join(HARNESS_DIR, 'rubrics');
export const ARTIFACTS_DIR = join(HARNESS_DIR, 'artifacts'); // run logs + captures + cache
export const CACHE_DIR = join(ARTIFACTS_DIR, 'verdict-cache');

/**
 * iOS simulator target. Defaults match the reference machine; override per
 * environment via SIM_DEVICE / SIM_OS without editing this file
 * (`xcrun simctl list devices available` shows what's installed locally).
 *
 * appId: matches `ios.bundleIdentifier` in apps/native/app.json — keep this,
 * app.json, and the Maestro flows' `appId:` lines in sync (they are
 * cross-referenced).
 */
export const SIM = {
  device: process.env.SIM_DEVICE || 'iPhone 17 Pro',
  os: process.env.SIM_OS || 'iOS 26',
  appId: 'com.handicappin.app',
};

/**
 * The rubric version. Bumping this (or the judge model) invalidates the
 * verdict cache AND the calibration — it is part of the cache key.
 */
export const RUBRIC_VERSION = 'bring-up-v1';

/**
 * Vision judge — model id with env override. The harness reads
 * ANTHROPIC_API_KEY from the environment and degrades honestly (clear message,
 * PENDING_HUMAN_SIGN_OFF, no crash) when it is absent. Changing the model
 * invalidates the verdict cache (judge/verdict-cache.mjs keys on it).
 */
export const JUDGE = {
  MODEL: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6',
  MAX_TOKENS: 2048,
};

/**
 * Verdict mode — human-in-the-loop (the ks sub-plan 08 DECISION, kept): the
 * loop proposes a quorum verdict and PAUSES on PENDING_HUMAN_SIGN_OFF; a human
 * makes the final equivalence call. The autonomous path stays reachable for
 * the documented re-evaluation trigger (borderline 3/3 AND overall ≥ 90% on
 * real native captures).
 */
export const VERDICT_MODE = 'human-in-the-loop'; // | 'autonomous-with-quorum'

/**
 * Loop control caps. Per-screen vision-call cap = ITERATION_CAP × QUORUM.
 * TOTAL_PASS_CEILING halts the WHOLE loop, not just one escalated screen.
 */
export const CAPS = {
  ITERATION_CAP: 8, // per-screen iterations before escalate-to-human
  QUORUM: 2, // independent judge passes that must agree
  get VISION_CALLS_PER_SCREEN() {
    return this.ITERATION_CAP * this.QUORUM; // 8 × 2 = 16 hard limit / screen
  },
  NO_PROGRESS_LIMIT: 3, // identical delta-set N times in a row → halt + escalate
  TOTAL_PASS_CEILING: 6, // whole-loop pass ceiling (each pass = one sweep of all screens)
  // Budget cap is derived from COST seeds below; see budgetCapUSD().
};

/**
 * Cost model — seeds measured in the ks calibration spike. These are INITIAL
 * numbers; loop/loop-control records the ACTUAL $/iteration + screens/hour
 * and the operator refines from them.
 */
export const COST = {
  // $ per 2-judgment pass (one iteration), production path.
  USD_PER_ITERATION_SONNET: 0.05,
  USD_PER_ITERATION_OPUS: 0.24,
  // Warm-reused sim throughput (quorum-latency dominated; capture itself ~1–2s).
  SCREENS_PER_HOUR_LOW: 90,
  SCREENS_PER_HOUR_HIGH: 130,
};

/**
 * Per-screen $ budget cap, derived from the iteration cap × measured cost.
 * Defaults to the Opus-tier (worst-case) rate so the cap is not optimistic.
 */
export function budgetCapUSD(tier = 'opus') {
  const perIter =
    tier === 'sonnet'
      ? COST.USD_PER_ITERATION_SONNET
      : COST.USD_PER_ITERATION_OPUS;
  return +(perIter * CAPS.ITERATION_CAP).toFixed(2);
}

/**
 * The screens under verification. ONE entry today: the root token-gallery
 * bring-up screen (apps/native/app/index.tsx, testID "token-gallery").
 *
 * Adding a screen as it is ported:
 *   1. create the route in apps/native/app/ (same slug as apps/web/app/) and
 *      remove it from INTENTIONAL.webOnly in scripts/parity/routes.mjs — the
 *      shared-route source of truth is computeParity().shared there;
 *   2. append the slug here and map its web reference path in WEB_PATHS;
 *   3. freeze a rubric at verification/rubrics/<screen>.yaml.
 *
 * e.g. SCREENS = ['index', 'rounds', 'statistics'];
 */
export const SCREENS = ['index', 'login', 'signup', 'forgot-password', 'update-password', 'verify-signup', 'verify-email', 'auth/verify-session', 'onboarding', '__gallery'];

/** Native screen slug → web reference path on the Next.js app (port 3000). */
export const WEB_PATHS = {
  index: '/', // authenticated home (sign in first); __gallery judged vs the contract
  __gallery: '/',
  login: '/login',
  signup: '/signup',
  'forgot-password': '/forgot-password',
  'update-password': '/update-password',
  'verify-signup': '/verify-signup',
  // verify-email + auth/verify-session: web twins are server redirect
  // handlers with no stable visual — rubrics score the native states
  // against the auth-cluster design language (see those rubric headers).
  'verify-email': '/verify-email',
  'auth/verify-session': '/auth/verify-session',
  onboarding: '/onboarding',
};

export const SMOKE_SCREEN = '__gallery';

/**
 * Web pre-filter mode. Starts 'per-iteration'; the yield gate (prefilter)
 * demotes it to 'smoke-only' (once-per-build launch/glyph check) if it averts
 * few iOS calls. Threshold: averted-iOS-calls / builds < YIELD_MIN → demote.
 */
export const PREFILTER = {
  mode: 'per-iteration', // | 'smoke-only'
  YIELD_MIN: 0.15, // <15% of builds averted an iOS call → demote
  staticExportDir: join(APP_DIR, 'dist'), // `expo export -p web` output
};
