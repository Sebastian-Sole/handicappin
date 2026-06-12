/**
 * Token-contrast gate test — proves the gate reproduces the frozen
 * spot-validated ratios for BOTH colour modes AND that it rejects a
 * sub-threshold pairing (so it is not a rubber stamp). Also pins the
 * waiver ledger EMPTY: the one waived web-side miss (dark text-on-primary,
 * 4.27:1) was fixed in the web tokens and must stay fixed.
 *
 *   node --test verification/gates/contrast-gate.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contrastRatio, round2 } from '../lib/color.mjs';
import { runContrastGate, evaluatePairing, THRESHOLD } from './contrast-gate.mjs';
import { loadTokens, colorModes } from '../lib/tokens.mjs';

// The exact tables frozen against packages/tokens/generated/tokens.ts
// (computed 2026-06-10). Token drift = these tests fail = re-validate.
const EXPECTED = {
  light: {
    'body-on-page': 17.15,
    'text-on-primary': 6.31,
    'body-on-card': 17.94,
    'muted-on-card': 5.94,
    'muted-on-page': 5.68,
    'secondary-chip': 11.19,
    'destructive-on-page': 5.15,
    'accent-chip': 12.53,
    'card-border-on-page': 1.28,
  },
  dark: {
    'body-on-page': 17.72,
    'text-on-primary': 5.31, // was 4.27 (waived) — web-side palette fix landed
    'body-on-card': 16.69,
    'muted-on-card': 7.05,
    'muted-on-page': 7.48,
    'secondary-chip': 10.16,
    'destructive-on-page': 4.53,
    'accent-chip': 11.82,
    'card-border-on-page': 1.37,
  },
};

test('reproduces the frozen contrast ratios exactly, per mode', async () => {
  const tokens = await loadTokens();
  for (const [mode, colors] of colorModes(tokens)) {
    const { results } = runContrastGate(colors, undefined, { mode });
    for (const r of results) {
      assert.equal(
        r.ratio,
        EXPECTED[mode][r.id],
        `${mode}/${r.id}: expected ${EXPECTED[mode][r.id]}, got ${r.ratio}`,
      );
    }
  }
});

test('both modes pass; the decorative divider is exempt (not a failure)', async () => {
  const tokens = await loadTokens();
  for (const [mode, colors] of colorModes(tokens)) {
    const { pass, failures, results } = runContrastGate(colors, undefined, { mode });
    assert.equal(pass, true, `${mode}: unexpected failures: ${JSON.stringify(failures)}`);
    const border = results.find((r) => r.id === 'card-border-on-page');
    assert.equal(border.exempt, true);
    assert.equal(border.pass, true); // exempt → not a failure
    assert.ok(border.ratio < THRESHOLD.LARGE_OR_UI); // …even though it is < 3:1
  }
});

test('the waiver ledger is EMPTY — dark text-on-primary was fixed web-side', async () => {
  const tokens = await loadTokens();
  for (const [mode, colors] of colorModes(tokens)) {
    const { waived, pass } = runContrastGate(colors, undefined, { mode });
    assert.equal(pass, true, `${mode}: gate must pass with no waivers`);
    assert.equal(waived.length, 0, `${mode}: no pairing may be waived anymore`);
  }
});

test('the waiver is exact-match: the SAME pairing in light mode still fails when broken', async () => {
  const tokens = await loadTokens();
  // Break light primary so text-on-primary lands sub-threshold in LIGHT mode.
  const broken = { ...tokens.colors.light, primary: '#7adb96' };
  const { pass, failures } = runContrastGate(broken, undefined, { mode: 'light' });
  assert.equal(pass, false);
  assert.ok(
    failures.some((f) => f.id === 'text-on-primary' && !f.waived),
    'light text-on-primary must NOT inherit the dark-mode waiver',
  );
});

test("yesterday's waived pairing is today's failure — the old sub-threshold values no longer pass", async () => {
  const tokens = await loadTokens();
  // Reintroduce the pre-fix dark pairing (#f8f8f8 on #008935 = 4.27:1):
  // with the waiver deleted it must FAIL, not silently re-waive.
  const regressed = {
    ...tokens.colors.dark,
    primary: '#008935',
    'primary-foreground': '#f8f8f8',
  };
  const { pass, failures } = runContrastGate(regressed, undefined, { mode: 'dark' });
  assert.equal(pass, false);
  assert.ok(failures.some((f) => f.id === 'text-on-primary' && !f.waived));
});

test('rejects a deliberately broken token (sub-threshold normal text) — gate is not a rubber stamp', async () => {
  const tokens = await loadTokens();
  const broken = { ...tokens.colors.light, foreground: '#bdbdbd' };
  const { pass, failures } = runContrastGate(broken, undefined, { mode: 'light' });
  assert.equal(pass, false);
  assert.ok(
    failures.some((f) => f.id === 'body-on-page'),
    'body-on-page should fail with a broken foreground token',
  );
});

test('destructive-on-page light is the thin-margin pairing (5.15 > 4.5)', () => {
  const ratio = round2(contrastRatio('#cc272e', '#f9fafa'));
  assert.equal(ratio, 5.15);
  assert.ok(ratio >= THRESHOLD.NORMAL);
});

test('alpha compositing: a translucent foreground is resolved before rating', () => {
  // overlay-class #000000cc fill over white → composited grey, lower than opaque black.
  const opaque = contrastRatio('#000000', '#ffffff');
  const translucent = contrastRatio('#000000cc', '#ffffff');
  assert.ok(translucent < opaque);
});

test('evaluatePairing throws on an unknown token (typo guard)', () => {
  assert.throws(() =>
    evaluatePairing({ id: 'x', fg: 'nope', bg: 'background', kind: 'normal' }, {
      background: '#ffffff',
    }),
  );
});
