/**
 * Web pre-filter (ported from the ks-digital reference) — CHEAP, never a verdict.
 *
 * Drives the Expo web STATIC EXPORT (`expo export -p web`), NOT the hot dev
 * server (the dev server diverges from what ships: tree-shaking, asset hashing,
 * expo-router static route gen, process.env inlining). Built once per code-change,
 * not once per judge call.
 *
 * Answers ONLY: did it crash? did glyphs load (no tofu/fallback font)? is the a11y
 * tree roughly the expected shape? It NEVER produces an equivalence verdict — the
 * iOS surface is the sole equivalence truth.
 *
 * Denylist (prefilter/denylist.mjs): components using backdrop-blur /
 * multi-layer box-shadow / CSS grid / position:sticky SKIP the web verdict
 * (false-PASS sources). The RNW #1604 false-FAIL is treated as expected.
 *
 * Driver: agent-browser + Playwright (the project's blessed browser tooling —
 * the same driver used against the Next.js app today; zero new infra).
 *
 * Yield gate: we record how many iOS-gate calls this pre-filter
 * actually AVERTS vs. how many denylisted screens it can say nothing about. If
 * yield is low it self-demotes to a once-per-build launch-smoke / glyph check —
 * no more `expo export -p web` per loop.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { PREFILTER } from '../config.mjs';
import { shouldSkipWebVerdict, isKnownFalseFail } from './denylist.mjs';

const exec = promisify(execFile);

/** Build the static export once. Returns the output dir (or throws on build fail). */
export async function buildStaticExport(appDir) {
  // `expo export -p web` — NOT `expo start --web` (dev server diverges from ship).
  await exec('npx', ['expo', 'export', '-p', 'web'], { cwd: appDir, timeout: 600000 });
  return PREFILTER.staticExportDir;
}

/**
 * Pre-filter ONE screen. Pure-ish: takes an injected `probe` that drives the
 * browser (agent-browser/Playwright) and returns crash/glyph/tree facts, so this
 * is testable without a live browser. The harness wires the real probe.
 *
 * @param {object} screen - { name, cssFeaturesUsed: string[] }
 * @param {(name:string)=>Promise<{crashed:boolean,tofu:boolean,treeShapeOk:boolean,websVerdict?:string,feature?:string}>} probe
 * @returns {Promise<{screen:string, decision:'PASS-SMOKE'|'FAIL-SMOKE'|'SKIP', reasons:string[], avertsIosCall:boolean}>}
 */
export async function preFilterScreen(screen, probe) {
  const { skip, reasons: denyReasons } = shouldSkipWebVerdict(screen.cssFeaturesUsed);
  if (skip) {
    // Denylisted → the web surface can say nothing trustworthy. SKIP (not a verdict).
    return {
      screen: screen.name,
      decision: 'SKIP',
      reasons: [`denylisted: ${denyReasons.join(', ')}`],
      avertsIosCall: false,
    };
  }

  const facts = await probe(screen.name);

  // Known RNW #1604 false-FAIL → ignore; do NOT break working native code.
  if (isKnownFalseFail({ feature: facts.feature, websVerdict: facts.websVerdict })) {
    return {
      screen: screen.name,
      decision: 'SKIP',
      reasons: ['RNW#1604 false-FAIL ignored (flex:0 collapses on web, renders native)'],
      avertsIosCall: false,
    };
  }

  const reasons = [];
  if (facts.crashed) reasons.push('crashed-on-web');
  if (facts.tofu) reasons.push('tofu/fallback-font');
  if (!facts.treeShapeOk) reasons.push('a11y-tree-shape-wrong');

  if (reasons.length > 0) {
    // Caught a gross error cheaply → averted an expensive iOS-gate call.
    return { screen: screen.name, decision: 'FAIL-SMOKE', reasons, avertsIosCall: true };
  }
  // Passed the cheap smoke — NOT an equivalence PASS, just "not grossly broken".
  return { screen: screen.name, decision: 'PASS-SMOKE', reasons: [], avertsIosCall: false };
}

/**
 * Yield gate: given the per-screen results across a build, decide whether the
 * pre-filter earns its keep. yield = averted-iOS-calls / non-skipped screens.
 * If below YIELD_MIN, recommend demotion to smoke-only.
 *
 * @param {Array<{decision:string, avertsIosCall:boolean}>} results
 * @returns {{ yield:number, averted:number, evaluated:number, skipped:number, recommend:'keep'|'demote-to-smoke-only' }}
 */
export function evaluateYield(results) {
  const evaluated = results.filter((r) => r.decision !== 'SKIP').length;
  const skipped = results.filter((r) => r.decision === 'SKIP').length;
  const averted = results.filter((r) => r.avertsIosCall).length;
  const y = evaluated === 0 ? 0 : averted / evaluated;
  return {
    yield: +y.toFixed(3),
    averted,
    evaluated,
    skipped,
    recommend: y < PREFILTER.YIELD_MIN ? 'demote-to-smoke-only' : 'keep',
  };
}
