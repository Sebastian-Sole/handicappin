/**
 * Token-contrast gate test — proves the gate reproduces the frozen
 * spot-validated ratios for BOTH colour modes AND that it rejects a
 * sub-threshold pairing (so it is not a rubber stamp). Also pins the one
 * waived web-side miss (dark text-on-primary) so the waiver can't widen.
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
    'text-on-primary': 4.27, // the known web-side miss — waived, frozen
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

test('dark text-on-primary is WAIVED (web-side miss), reported, and frozen at 4.27', async () => {
  const tokens = await loadTokens();
  const { waived, pass } = runContrastGate(tokens.colors.dark, undefined, { mode: 'dark' });
  assert.equal(pass, true);
  assert.equal(waived.length, 1); // exactly one waiver — it cannot silently widen
  assert.equal(waived[0].id, 'text-on-primary');
  assert.equal(waived[0].ratio, 4.27);
  assert.ok(waived[0].ratio < THRESHOLD.NORMAL); // it IS below threshold…
  assert.match(waived[0].waiverReason, /web/i); // …and the reason names the real fix site
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

test('the waiver does not cover a regression PAST the frozen ratio', async () => {
  const tokens = await loadTokens();
  // Push dark primary lighter → ratio drops below the frozen 4.27.
  const broken = { ...tokens.colors.dark, primary: '#33aa55' };
  const { pass, failures } = runContrastGate(broken, undefined, { mode: 'dark' });
  assert.equal(pass, false);
  assert.ok(failures.some((f) => f.id === 'text-on-primary'));
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
