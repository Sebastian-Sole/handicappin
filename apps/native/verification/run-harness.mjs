/**
 * Verification harness — end-to-end orchestrator for ONE screen.
 * Ported from the ks-digital reference (apps/app/verification/run-harness.mjs).
 *
 * Pipeline:
 *   web pre-filter (or skip-by-denylist)
 *     → warm-sim iOS capture (clean, font-ready + data-settled frame)
 *       → vision quorum + Maestro behavioral assert + a11y/glyph check
 *         → a boolean rubric verdict + an iteration log
 *
 * iOS is the SOLE equivalence truth. Verdict mode = human-in-the-loop: the
 * loop PROPOSES a verdict and PAUSES on PENDING_HUMAN_SIGN_OFF. Everything is
 * local + reproducible ($0 infra beyond the metered judge calls).
 *
 * The expensive/live stages are INJECTED (probe / capture / judge) so the
 * pipeline is runnable and testable now, with one native screen, and degrades
 * HONESTLY ("iOS gate unavailable", "judge disabled") instead of faking green.
 * The CLI wires the real Anthropic judge when ANTHROPIC_API_KEY is set
 * (judge/vision-judge.mjs); tests inject fakes and never touch the network.
 *
 * Contract difference vs ks: the token contract is PER-MODE, so the contrast
 * gate runs once per colour mode (light + dark) per iteration.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  ARTIFACTS_DIR,
  SMOKE_SCREEN,
  VERDICT_MODE,
  RUBRIC_VERSION,
  budgetCapUSD,
  COST,
} from './config.mjs';
import { loadTokens, colorModes } from './lib/tokens.mjs';
import { runContrastGate } from './gates/contrast-gate.mjs';
import { buildA11yReport } from './gates/a11y-checks.mjs';
import { preFilterScreen } from './prefilter/web-prefilter.mjs';
import { isCaptureReady } from './ios-gate/capture-hygiene.mjs';
import { buildJudgePrompt } from './judge/build-prompt.mjs';
import { quorumVerdict, proposeVerdict, MODE } from './judge/quorum.mjs';
import {
  createScreenState,
  recordIteration,
  nextIterationDecision,
  applyStop,
  verifiedName,
} from './loop/loop-control.mjs';

/** Default injected stages — degrade honestly when nothing is wired. */
const NOOP_PROBE = async () => ({ crashed: false, tofu: false, treeShapeOk: true });
const UNAVAILABLE_CAPTURE = async () => {
  throw new Error('iOS capture not wired (start sim + install app, pass opts.capture)');
};
const NO_JUDGE = async () => null; // → no model call → PENDING_HUMAN_SIGN_OFF

/**
 * Run the harness for one screen.
 *
 * @param {string} screen
 * @param {object} [opts]
 * @param {string[]} [opts.cssFeaturesUsed]   - for denylist routing
 * @param {Function} [opts.probe]             - web pre-filter probe
 * @param {Function} [opts.capture]           - returns {treeSnapshot, iosBytes, webBytes}
 * @param {Function} [opts.judge]             - (prompt, images, pass) → Judgment
 * @param {string}   [opts.mode]              - verdict mode (default config)
 * @param {Record<string,string>} [opts.colorsOverride] - inject a broken flat
 *   colour map (dry-run); judged as a single 'light' mode.
 * @returns {Promise<object>} the iteration log
 */
export async function runHarness(screen = SMOKE_SCREEN, opts = {}) {
  const {
    cssFeaturesUsed = [],
    probe = NOOP_PROBE,
    capture = UNAVAILABLE_CAPTURE,
    judge = NO_JUDGE,
    mode = VERDICT_MODE,
    colorsOverride,
  } = opts;

  const tokens = await loadTokens();
  // Per-mode colour maps — the dry-run override replaces the whole record.
  const modes = colorsOverride
    ? [['light', colorsOverride]]
    : colorModes(tokens);
  const st = createScreenState(screen);
  const log = {
    screen,
    rubric_version: RUBRIC_VERSION,
    mode,
    started_iteration: st.iterations + 1,
    budget_cap_usd: budgetCapUSD(),
    cost_seed: { usd_per_iteration: COST.USD_PER_ITERATION_OPUS, screens_per_hour: [COST.SCREENS_PER_HOUR_LOW, COST.SCREENS_PER_HOUR_HIGH] },
    stages: {},
    redItems: [],
  };

  // ── Stage 1: web pre-filter (cheap, never a verdict) ──────────────────────
  const pf = await preFilterScreen({ name: screen, cssFeaturesUsed }, probe);
  log.stages.web_prefilter = pf;
  if (pf.decision === 'FAIL-SMOKE') {
    log.redItems.push(`web-smoke:${pf.reasons.join(',')}`);
  }

  // ── Stage 2: deterministic gates (cheap tier), per colour mode ────────────
  const contrastByMode = {};
  for (const [m, colors] of modes) {
    const r = runContrastGate(colors, undefined, { mode: m });
    contrastByMode[m] = { pass: r.pass, failures: r.failures, waived: r.waived };
    if (!r.pass) {
      log.redItems.push(...r.failures.map((f) => `contrast:${m}:${f.id}`));
    }
  }
  const contrastPass = Object.values(contrastByMode).every((m) => m.pass);
  log.stages.contrast_gate = { pass: contrastPass, modes: contrastByMode };

  const a11y = buildA11yReport({
    screen,
    colors: Object.fromEntries(modes),
    glyphsRendered: opts.glyphsRendered,
  });
  log.stages.a11y = { deterministicPass: a11y.deterministicPass, pending: a11y.pending, rows: a11y.rows.map((r) => ({ id: r.id, wcag: r.wcag, tier: r.tier, status: r.status })) };
  if (!a11y.deterministicPass) log.redItems.push('a11y:deterministic-fail');

  // ── Stage 3: iOS truth gate — warm-sim capture (clean frame) ──────────────
  let captured = null;
  try {
    captured = await capture(screen);
    const ready = isCaptureReady(captured.treeSnapshot ?? { testIds: [], labels: [] });
    log.stages.ios_capture = { available: true, frameReady: ready.ready, reasons: ready.reasons };
    if (!ready.ready) {
      // Bad frame → discard BEFORE spending a vision call.
      log.stages.ios_capture.discarded = true;
      log.redItems.push(`capture-hygiene:${ready.reasons.join(',')}`);
    }
  } catch (err) {
    log.stages.ios_capture = { available: false, note: err.message };
  }

  // ── Stage 4: vision quorum (only on a clean frame) ────────────────────────
  const prompt = await buildJudgePrompt(screen);
  log.stages.judge = { prompt_chars: prompt.length, reference_in_prompt: true };
  if (judge.model) log.stages.judge.model = judge.model;
  if (captured?.treeSnapshot && isCaptureReady(captured.treeSnapshot).ready) {
    const j1 = await judge(prompt, captured, 1);
    const j2 = await judge(prompt, captured, 2);
    if (j1 && j2) {
      const q = quorumVerdict(j1, j2);
      const record = proposeVerdict(screen, q, mode);
      log.stages.judge.quorum = q;
      log.stages.judge.signoff = record;
      recordIteration(st, { redItems: q.verdict === 'PASS' ? [] : Object.keys(q.perItem).filter((k) => !q.perItem[k].pass), visionCallsUsed: 2 });
      if (record.status === 'PENDING_HUMAN_SIGN_OFF') log.redItems.push('judge:PENDING_HUMAN_SIGN_OFF');
      else if (record.final_verdict === 'FAIL') log.redItems.push('judge:FAIL');
    } else {
      log.stages.judge.note = judge.lastError
        ? `judge error → human sign-off required (${judge.lastError})`
        : 'no judge model wired → human-in-the-loop sign-off required';
      log.redItems.push('judge:PENDING_HUMAN_SIGN_OFF');
    }
  } else {
    log.stages.judge.note = 'skipped — no clean iOS frame to judge';
  }

  // ── Verdict + loop bookkeeping ────────────────────────────────────────────
  if (st.iterations === 0) recordIteration(st, { redItems: log.redItems, visionCallsUsed: 0 });
  const decision = nextIterationDecision(st);
  if (!decision.continue && st.status !== 'verified') applyStop(st, decision);

  log.verdict = log.redItems.length === 0 && mode === MODE.AUTONOMOUS ? 'PASS' : 'NOT-CONVERGED';
  log.verified_name = log.redItems.length === 0 ? verifiedName(screen) : null;
  log.loop = { iterations: st.iterations, visionCalls: st.visionCalls, spentUSD: st.spentUSD, status: st.status, next: decision };

  // ── Persist the iteration log (live-reproducible artifact) ────────────────
  await mkdir(ARTIFACTS_DIR, { recursive: true });
  const logPath = join(ARTIFACTS_DIR, `run-${screen}.json`);
  await writeFile(logPath, `${JSON.stringify(log, null, 2)}\n`);
  log.logPath = logPath;
  return log;
}

// CLI: `node verification/run-harness.mjs [screen]`
if (import.meta.url === `file://${process.argv[1]}`) {
  // Wire the real Anthropic judge only on the CLI path — tests stay hermetic.
  const { createVisionJudge, NO_KEY_MESSAGE } = await import('./judge/vision-judge.mjs');
  const liveJudge = createVisionJudge();
  if (!liveJudge) console.warn(`▌ ${NO_KEY_MESSAGE}`);

  const screen = process.argv[2] ?? SMOKE_SCREEN;
  runHarness(screen, liveJudge ? { judge: liveJudge } : {}).then((log) => {
    const ic = log.stages.ios_capture;
    console.log(`\n▌ Harness run — ${screen} (rubric ${log.rubric_version}, mode ${log.mode})`);
    console.log(`  web pre-filter : ${log.stages.web_prefilter.decision}`);
    console.log(`  contrast gate  : ${log.stages.contrast_gate.pass ? 'PASS' : 'FAIL'} (light+dark)`);
    console.log(`  a11y (det.)    : ${log.stages.a11y.deterministicPass ? 'PASS' : 'FAIL'} · pending-live: ${log.stages.a11y.pending.join(', ')}`);
    console.log(`  iOS capture    : ${ic.available ? (ic.frameReady ? 'clean frame' : 'bad frame discarded') : `unavailable (${ic.note})`}`);
    console.log(`  judge          : ${log.stages.judge.quorum ? log.stages.judge.signoff.status : (log.stages.judge.note ?? 'n/a')}`);
    console.log(`  verdict        : ${log.verdict}  red: [${log.redItems.join(', ')}]`);
    console.log(`  → ${log.logPath}\n`);
  });
}
