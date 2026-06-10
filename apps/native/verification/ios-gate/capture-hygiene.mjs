/**
 * Capture hygiene (ported from the ks-digital reference) — stops verdict
 * oscillation.
 *
 * Font/data races are the DOCUMENTED cause of PASS/FAIL/PASS oscillation on
 * identical code. A vision call on a skeleton or fallback-font frame is wasted
 * budget AND poisons the verdict. So EVERY capture is gated, and deterministic
 * pre-checks discard a known-bad frame BEFORE a judge call is ever spent.
 *
 * The gate reads the SAME signals the app exposes — not a screenshot heuristic:
 *   - font-ready:  the `fonts-ready` testID marker (apps/native/lib/fonts.ts
 *                  FONTS_READY_TEST_ID, rendered by app/_layout.tsx); the app
 *                  renders nothing under the splash until `useAppFonts` resolves.
 *   - data-settled: the `data-settled` accessibilityLabel, to be rendered once
 *                  every query on the screen has settled. The app does NOT emit
 *                  this yet (the token gallery is static — no data layer), so a
 *                  live capture honestly reports `data-not-settled` until the
 *                  first data screen lands and wires the marker. Wire the
 *                  marker then; do not relax this predicate to paper over it.
 *
 * ImageMagick is for NORMALIZATION only (crop status bar, resize) — never a verdict.
 */

/** The a11y-tree markers the gate polls for. Must match the app's emitters. */
export const FONTS_READY_TEST_ID = 'fonts-ready';
export const DATA_SETTLED_LABEL = 'data-settled';
/** Markers whose presence means the frame is NOT capture-ready. */
export const SKELETON_LABEL = 'skeleton';
export const FALLBACK_FONT_MARKER = 'fallback-font'; // emitted if a face fails to load

/**
 * Decide whether an a11y-tree snapshot represents a clean, capture-ready frame.
 * Pure predicate over the marker set so it is unit-testable with no sim.
 *
 * @param {object} tree
 * @param {string[]} tree.testIds  - testIDs present in the a11y tree
 * @param {string[]} tree.labels   - accessibilityLabels present in the a11y tree
 * @returns {{ ready: boolean, reasons: string[] }}
 *          ready=false → discard and re-capture; never pay a judge call.
 */
export function isCaptureReady(tree) {
  const testIds = tree.testIds ?? [];
  const labels = tree.labels ?? [];
  const reasons = [];

  if (!testIds.includes(FONTS_READY_TEST_ID)) reasons.push('fonts-not-ready');
  if (!labels.includes(DATA_SETTLED_LABEL)) reasons.push('data-not-settled');
  // Deterministic bad-frame pre-checks (discard BEFORE a vision call):
  if (labels.includes(SKELETON_LABEL)) reasons.push('skeleton-in-tree');
  if (
    labels.includes(FALLBACK_FONT_MARKER) ||
    testIds.includes(FALLBACK_FONT_MARKER)
  ) {
    reasons.push('fallback-font-detected');
  }

  return { ready: reasons.length === 0, reasons };
}

/**
 * Poll an a11y-tree source until the frame is capture-ready or the budget runs out.
 * Keeps the harness from ever spending a judge call on a known-bad frame.
 *
 * @param {() => Promise<{testIds:string[],labels:string[]}>} readTree
 * @param {object} [opts]
 * @param {number} [opts.timeoutMs=8000]
 * @param {number} [opts.intervalMs=250]
 * @param {(ms:number)=>Promise<void>} [opts.sleep] - injectable for tests
 * @returns {Promise<{ready:boolean, reasons:string[], waitedMs:number, attempts:number}>}
 */
export async function waitForCleanFrame(readTree, opts = {}) {
  const {
    timeoutMs = 8000,
    intervalMs = 250,
    sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
    now = () => Date.now(),
  } = opts;
  const start = now();
  let attempts = 0;
  let last = { ready: false, reasons: ['not-polled'] };
  while (now() - start < timeoutMs) {
    attempts++;
    last = isCaptureReady(await readTree());
    if (last.ready) break;
    await sleep(intervalMs);
  }
  return { ...last, waitedMs: now() - start, attempts };
}
