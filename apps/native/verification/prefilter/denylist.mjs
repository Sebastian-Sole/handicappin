/**
 * Web pre-filter denylist + RNW false-FAIL guard (ported from the ks-digital
 * reference).
 *
 * The web pre-filter is a CHEAP gate that answers ONLY crash/glyph/tree-shape —
 * never an equivalence verdict. Two documented failure modes make a blanket web
 * verdict actively harmful:
 *
 *  - FALSE PASS: `backdrop-blur`, full multi-layer `box-shadow`, CSS grid, and
 *    `position: sticky` render on RNW/Chromium but degrade or vanish on iOS. A
 *    web PASS here defers detection to the expensive iOS surface — the opposite
 *    of a pre-filter's job. Components using these SKIP the web verdict.
 *  - FALSE FAIL: RNW issue #1604 — `flex:0` + explicit size renders native but
 *    collapses to 0px on web. A naive agent would "fix" working native code to
 *    satisfy the web artifact, a self-inflicted regression. The guard marks this
 *    EXPECTED so it is never chased.
 */

/** CSS features that make the web surface a false-PASS source → skip web verdict. */
export const DENYLISTED_CSS = Object.freeze([
  'backdrop-blur',
  'box-shadow-multilayer',
  'css-grid',
  'position-sticky',
]);

/**
 * Decide whether a component's web verdict should be SKIPPED.
 * @param {string[]} cssFeaturesUsed - feature tags the component renders with.
 * @returns {{ skip: boolean, reasons: string[] }}
 */
export function shouldSkipWebVerdict(cssFeaturesUsed = []) {
  const reasons = cssFeaturesUsed.filter((f) => DENYLISTED_CSS.includes(f));
  return { skip: reasons.length > 0, reasons };
}

/**
 * RNW issue #1604 false-FAIL guard. A web FAIL caused only by `flex:0`-collapse
 * is EXPECTED and must NOT trigger a native code change.
 * @returns {boolean} true if the web FAIL is the known #1604 artifact (ignore it).
 */
export function isKnownFalseFail({ feature, websVerdict }) {
  return feature === 'flex-0-explicit-size' && websVerdict === 'FAIL';
}
