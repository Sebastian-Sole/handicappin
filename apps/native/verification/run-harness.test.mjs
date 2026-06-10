/**
 * Dry-run proof (ported from the ks-digital reference): a deliberately-broken
 * screen is REJECTED by the appropriate check — proving the gate is not a
 * rubber stamp. Also proves the happy path proposes a verdict and PAUSES for
 * human sign-off. Hermetic: every live stage is injected; no sim, no API key.
 *
 *   node --test verification/run-harness.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runHarness } from './run-harness.mjs';
import { loadTokens } from './lib/tokens.mjs';
import { MODE } from './judge/quorum.mjs';

const cleanTree = { testIds: ['fonts-ready'], labels: ['data-settled', 'Token gallery'] };
const goodCapture = async () => ({
  treeSnapshot: cleanTree,
  iosBytes: Buffer.from('ios'),
  webBytes: Buffer.from('web'),
});
const passJudge = async () => ({
  overall: 'PASS',
  items: { layout_structure: true, color_tokens: true, type_hierarchy: true },
  glyph_rendering: true,
});

test('DRY-RUN 1 — wrong colour token is rejected by the contrast gate', async () => {
  const { colors } = await loadTokens();
  const broken = { ...colors.light, foreground: '#c9c9c9' }; // fails 4.5:1 on near-white
  const log = await runHarness('index', {
    colorsOverride: broken,
    capture: goodCapture,
    judge: passJudge,
  });
  assert.equal(log.stages.contrast_gate.pass, false);
  assert.ok(log.redItems.some((r) => r.startsWith('contrast:')));
  assert.equal(log.verdict, 'NOT-CONVERGED');
  assert.equal(log.verified_name, null); // never flips to verified_
});

test('DRY-RUN 2 — tofu glyph frame is discarded before a vision call is spent', async () => {
  const tofuCapture = async () => ({
    treeSnapshot: { testIds: ['fonts-ready', 'fallback-font'], labels: ['data-settled'] },
    iosBytes: Buffer.from('ios'),
    webBytes: Buffer.from('web'),
  });
  const log = await runHarness('index', { capture: tofuCapture, judge: passJudge });
  assert.equal(log.stages.ios_capture.frameReady, false);
  assert.equal(log.stages.ios_capture.discarded, true);
  assert.ok(log.redItems.some((r) => r.startsWith('capture-hygiene:')));
  // Judge was NOT run on the bad frame.
  assert.equal(log.stages.judge.quorum, undefined);
});

test('DRY-RUN 3 — dead/missing component (judge FAIL) is rejected by the vision quorum', async () => {
  const failJudge = async () => ({
    overall: 'FAIL',
    items: { layout_structure: true, components_present: false }, // missing surface card
    glyph_rendering: true,
  });
  const log = await runHarness('index', {
    capture: goodCapture,
    judge: failJudge,
    mode: MODE.AUTONOMOUS, // resolve without a human to prove the FAIL lands
  });
  assert.equal(log.stages.judge.quorum.verdict, 'FAIL');
  assert.ok(log.redItems.includes('judge:FAIL'));
  assert.equal(log.verified_name, null);
});

test('HAPPY PATH — clean screen proposes PASS and PAUSES for human sign-off (HITL)', async () => {
  const log = await runHarness('index', {
    capture: goodCapture,
    judge: passJudge,
    mode: MODE.HUMAN,
    glyphsRendered: undefined,
  });
  assert.equal(log.stages.contrast_gate.pass, true); // both modes (dark waiver applies)
  assert.equal(log.stages.judge.quorum.verdict, 'PASS');
  // The model says PASS, but the harness does NOT self-certify — it pauses.
  assert.equal(log.stages.judge.signoff.status, 'PENDING_HUMAN_SIGN_OFF');
  assert.ok(log.redItems.includes('judge:PENDING_HUMAN_SIGN_OFF'));
  assert.equal(log.verdict, 'NOT-CONVERGED'); // human must sign off
});

test('the contrast stage covers BOTH colour modes (per-mode contract)', async () => {
  const log = await runHarness('index', { capture: goodCapture, judge: passJudge });
  assert.deepEqual(Object.keys(log.stages.contrast_gate.modes).sort(), ['dark', 'light']);
  // The known web-side miss is reported as waived, not silently green.
  assert.equal(log.stages.contrast_gate.modes.dark.waived.length, 1);
  assert.equal(log.stages.contrast_gate.modes.dark.waived[0].id, 'text-on-primary');
});

test('iOS gate degrades HONESTLY when no sim is wired (no fake green)', async () => {
  const log = await runHarness('index', { judge: passJudge });
  assert.equal(log.stages.ios_capture.available, false);
  assert.match(log.stages.ios_capture.note, /not wired|no booted/i);
  assert.notEqual(log.verdict, 'PASS');
});

test('no judge wired → quorum skipped, screen pauses for a human (graceful, no crash)', async () => {
  const log = await runHarness('index', { capture: goodCapture }); // default NO_JUDGE
  assert.equal(log.stages.judge.quorum, undefined);
  assert.match(log.stages.judge.note, /human-in-the-loop sign-off required/);
  assert.ok(log.redItems.includes('judge:PENDING_HUMAN_SIGN_OFF'));
});

test('the reference screenshot is declared in-prompt every iteration (anti-drift)', async () => {
  const log = await runHarness('index', { capture: goodCapture, judge: passJudge });
  assert.equal(log.stages.judge.reference_in_prompt, true);
  assert.ok(log.stages.judge.prompt_chars > 500);
});
