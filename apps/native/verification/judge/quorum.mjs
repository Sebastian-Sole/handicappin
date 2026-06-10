/**
 * 2-judgment quorum + verdict mode wiring (ported from the ks-digital reference).
 *
 * Quorum: two INDEPENDENT judge passes must agree on PASS for every boolean item.
 * A split (PASS/FAIL) on any item counts as FAIL for that item and re-iterates —
 * this damps model variance. (The quorum is consistent but offers no protection
 * against a SHARED systematic blind spot — which is exactly why the verdict
 * mode below is human-in-the-loop, not autonomous.)
 *
 * Verdict mode (default = human-in-the-loop):
 *   - the loop computes the quorum and PROPOSES a per-screen verdict;
 *   - a human makes the FINAL equivalence call on the iOS capture before converge;
 *   - the autonomous path stays reachable for the re-evaluation trigger.
 * The human path is reachable in BOTH modes (acceptance criterion).
 */

/** One judge judgment shape (matches the frozen prompt's JSON output). */
/** @typedef {{overall:'PASS'|'FAIL', items:Record<string,boolean>, glyph_rendering:boolean, primary_reason?:string, confidence?:number}} Judgment */

/**
 * Combine two judgments into a per-item quorum + overall.
 * @param {Judgment} j1
 * @param {Judgment} j2
 * @returns {{ verdict:'PASS'|'FAIL', perItem:Record<string,{j1:boolean,j2:boolean,pass:boolean}>, glyphPass:boolean, splits:string[] }}
 */
export function quorumVerdict(j1, j2) {
  const itemKeys = new Set([...Object.keys(j1.items ?? {}), ...Object.keys(j2.items ?? {})]);
  const perItem = {};
  const splits = [];
  for (const k of itemKeys) {
    const a = j1.items?.[k] === true;
    const b = j2.items?.[k] === true;
    const pass = a && b; // both must agree PASS
    perItem[k] = { j1: a, j2: b, pass };
    if (a !== b) splits.push(k);
  }
  const glyphPass = j1.glyph_rendering === true && j2.glyph_rendering === true;
  if (j1.glyph_rendering !== j2.glyph_rendering) splits.push('glyph_rendering');
  const allItemsPass = Object.values(perItem).every((v) => v.pass);
  const verdict = allItemsPass && glyphPass ? 'PASS' : 'FAIL';
  return { verdict, perItem, glyphPass, splits };
}

/** Verdict-mode constants. */
export const MODE = Object.freeze({
  HUMAN: 'human-in-the-loop',
  AUTONOMOUS: 'autonomous-with-quorum',
});

/**
 * Produce a sign-off record for a screen given the quorum verdict + mode.
 * In HUMAN mode the record PAUSES (PENDING_HUMAN_SIGN_OFF); in AUTONOMOUS mode
 * the quorum is final and the record is resolved immediately.
 *
 * @returns {{screen:string, mode:string, proposed_verdict:string, status:string, human_signoff:string|null, final_verdict:string|null}}
 */
export function proposeVerdict(screen, quorum, mode) {
  const proposed = quorum.verdict;
  if (mode === MODE.AUTONOMOUS) {
    return {
      screen,
      mode,
      proposed_verdict: proposed,
      status: 'RESOLVED',
      human_signoff: null,
      final_verdict: proposed,
    };
  }
  // human-in-the-loop (default): propose + pause.
  return {
    screen,
    mode: MODE.HUMAN,
    proposed_verdict: proposed,
    status: 'PENDING_HUMAN_SIGN_OFF',
    human_signoff: null,
    final_verdict: null,
  };
}

/**
 * A human resolves a PENDING record. The human's call is final on the iOS
 * capture — the harness does NOT self-certify the visual verdict in HITL mode.
 * @param {object} record
 * @param {'PASS'|'FAIL'} humanVerdict
 */
export function resolveSignoff(record, humanVerdict) {
  if (humanVerdict !== 'PASS' && humanVerdict !== 'FAIL') {
    throw new Error(`resolveSignoff: humanVerdict must be PASS|FAIL, got ${humanVerdict}`);
  }
  return {
    ...record,
    status: 'RESOLVED',
    human_signoff: humanVerdict,
    final_verdict: humanVerdict,
  };
}

/** A screen is converged only when its visual verdict is finally PASS. */
export function isVisuallyConverged(record) {
  return record.status === 'RESOLVED' && record.final_verdict === 'PASS';
}
