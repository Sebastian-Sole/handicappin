/**
 * Loop control (ported from the ks-digital reference) — makes "iterate until
 * equivalent" actually
 * TERMINATE. Agents have no implicit memory of their own history, so every stop
 * condition is made EXPLICIT and structured here.
 *
 * Guarantees:
 *   - hard iteration cap + per-screen $ budget cap;
 *   - total-pass ceiling that halts the WHOLE loop (not just escalates one screen);
 *   - `verified_`-prefix gating: a screen cannot be claimed done without the gate
 *     flipping its name to `verified_<screen>` — verification is a hard gate;
 *   - no-progress detector: if the delta-set (the recurring diff) hasn't shrunk in
 *     N iterations, HALT + escalate rather than burn budget;
 *   - the delta-hash doubles as the judge-cache key for that iteration;
 *   - per-screen acceptance (one red screen never blocks a green one);
 *   - per-screen / per-pass vision-call cap = iteration_cap × quorum.
 */
import { createHash } from 'node:crypto';
import { CAPS, budgetCapUSD } from '../config.mjs';

/** Stable hash of the current delta-set (the still-red rubric items). */
export function deltaHash(redItems) {
  const norm = [...redItems].sort().join('|');
  return createHash('sha256').update(norm).digest('hex').slice(0, 16);
}

/** The hard gate: a screen is "done" only under the verified_ prefix. */
export function verifiedName(screen) {
  return `verified_${screen}`;
}
export function isVerified(name) {
  return name.startsWith('verified_');
}

/**
 * Per-screen loop state. Created fresh per screen (per-screen acceptance).
 * Tracks iterations, spend, and the rolling delta-hash history for no-progress.
 */
export function createScreenState(screen, { tier = 'opus' } = {}) {
  return {
    screen,
    iterations: 0,
    visionCalls: 0,
    spentUSD: 0,
    deltaHistory: [], // most-recent-last delta hashes
    status: 'iterating', // 'iterating' | 'verified' | 'escalated' | 'halted'
    haltReason: null,
    budgetCapUSD: budgetCapUSD(tier),
    perIterationUSD: budgetCapUSD(tier) / CAPS.ITERATION_CAP,
  };
}

/**
 * Decide whether the screen loop should CONTINUE or stop, BEFORE running the next
 * iteration. Returns a structured decision; the orchestrator obeys it.
 *
 * @param {object} st - screen state from createScreenState
 * @returns {{ continue:boolean, reason:string }}
 */
export function nextIterationDecision(st) {
  if (st.status === 'verified') return { continue: false, reason: 'already-verified' };
  if (st.iterations >= CAPS.ITERATION_CAP)
    return { continue: false, reason: 'iteration-cap-reached → escalate-to-human' };
  if (st.visionCalls >= CAPS.VISION_CALLS_PER_SCREEN)
    return { continue: false, reason: 'vision-call-cap-reached → escalate-to-human' };
  if (st.spentUSD >= st.budgetCapUSD)
    return { continue: false, reason: 'budget-cap-reached → escalate-to-human' };

  // No-progress: the SAME delta-set recurring NO_PROGRESS_LIMIT times → halt.
  const h = st.deltaHistory;
  if (h.length >= CAPS.NO_PROGRESS_LIMIT) {
    const recent = h.slice(-CAPS.NO_PROGRESS_LIMIT);
    if (recent.every((x) => x === recent[0])) {
      return {
        continue: false,
        reason: `no-progress: identical delta-set ×${CAPS.NO_PROGRESS_LIMIT} → halt-and-escalate`,
      };
    }
  }
  return { continue: true, reason: 'ok' };
}

/**
 * Record one completed iteration: bump counters, spend, and the delta history.
 * @param {object} st
 * @param {object} result - { redItems:string[], visionCallsUsed:number }
 * @returns {string} the delta-hash for this iteration (also the cache key)
 */
export function recordIteration(st, result) {
  st.iterations++;
  st.visionCalls += result.visionCallsUsed ?? CAPS.QUORUM;
  st.spentUSD = +(st.spentUSD + st.perIterationUSD).toFixed(4);
  const hash = deltaHash(result.redItems ?? []);
  st.deltaHistory.push(hash);
  if ((result.redItems ?? []).length === 0) st.status = 'verified';
  return hash;
}

/** Apply the stop decision's terminal status to the state. */
export function applyStop(st, decision) {
  if (st.status === 'verified') return st;
  st.status = decision.reason.includes('no-progress') ? 'halted' : 'escalated';
  st.haltReason = decision.reason;
  return st;
}

/**
 * Whole-loop controller across all screens — enforces the TOTAL_PASS_CEILING that
 * halts everything (not just one escalated screen). One "pass" = one sweep of the
 * not-yet-verified screens.
 */
export function createLoopState() {
  return { passes: 0, status: 'running' };
}

export function nextPassDecision(loop, screenStates) {
  const allDone = screenStates.every(
    (s) => s.status === 'verified' || s.status === 'escalated' || s.status === 'halted',
  );
  if (allDone) return { continue: false, reason: 'all-screens-terminal' };
  if (loop.passes >= CAPS.TOTAL_PASS_CEILING)
    return { continue: false, reason: 'total-pass-ceiling-reached → halt whole loop' };
  return { continue: true, reason: 'ok' };
}
