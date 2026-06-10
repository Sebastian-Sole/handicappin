import { test } from 'node:test';
import assert from 'node:assert/strict';
import { preFilterScreen, evaluateYield } from './web-prefilter.mjs';
import { shouldSkipWebVerdict, isKnownFalseFail } from './denylist.mjs';

const okProbe = async () => ({ crashed: false, tofu: false, treeShapeOk: true });

test('denylisted CSS skips the web verdict (false-PASS source, never trusted)', async () => {
  const r = await preFilterScreen(
    { name: 'statistics', cssFeaturesUsed: ['backdrop-blur'] },
    okProbe,
  );
  assert.equal(r.decision, 'SKIP');
  assert.match(r.reasons[0], /denylisted/);
});

test('shouldSkipWebVerdict lists every denylisted feature it matched', () => {
  const { skip, reasons } = shouldSkipWebVerdict(['css-grid', 'position-sticky', 'flex']);
  assert.equal(skip, true);
  assert.deepEqual(reasons, ['css-grid', 'position-sticky']);
});

test('a crash on web is caught cheaply and averts an iOS call', async () => {
  const probe = async () => ({ crashed: true, tofu: false, treeShapeOk: true });
  const r = await preFilterScreen({ name: 'rounds', cssFeaturesUsed: [] }, probe);
  assert.equal(r.decision, 'FAIL-SMOKE');
  assert.equal(r.avertsIosCall, true);
  assert.ok(r.reasons.includes('crashed-on-web'));
});

test('tofu (missing glyphs) is caught by the cheap pre-filter', async () => {
  const probe = async () => ({ crashed: false, tofu: true, treeShapeOk: true });
  const r = await preFilterScreen({ name: 'index', cssFeaturesUsed: [] }, probe);
  assert.equal(r.decision, 'FAIL-SMOKE');
  assert.ok(r.reasons.includes('tofu/fallback-font'));
});

test('RNW #1604 false-FAIL is ignored — no self-inflicted native regression', async () => {
  const probe = async () => ({
    crashed: false,
    tofu: false,
    treeShapeOk: false,
    feature: 'flex-0-explicit-size',
    websVerdict: 'FAIL',
  });
  const r = await preFilterScreen({ name: 'dashboard', cssFeaturesUsed: [] }, probe);
  assert.equal(r.decision, 'SKIP');
  assert.match(r.reasons[0], /1604/);
  assert.equal(isKnownFalseFail({ feature: 'flex-0-explicit-size', websVerdict: 'FAIL' }), true);
});

test('a clean screen passes the smoke (but that is NOT an equivalence verdict)', async () => {
  const r = await preFilterScreen({ name: 'index', cssFeaturesUsed: [] }, okProbe);
  assert.equal(r.decision, 'PASS-SMOKE');
  assert.equal(r.avertsIosCall, false);
});

test('yield gate recommends demotion when the pre-filter averts few iOS calls', () => {
  // 1 averted out of 8 evaluated = 0.125 < 0.15 → demote.
  const results = [
    { decision: 'FAIL-SMOKE', avertsIosCall: true },
    ...Array.from({ length: 7 }, () => ({ decision: 'PASS-SMOKE', avertsIosCall: false })),
    { decision: 'SKIP', avertsIosCall: false },
  ];
  const y = evaluateYield(results);
  assert.equal(y.evaluated, 8);
  assert.equal(y.skipped, 1);
  assert.equal(y.recommend, 'demote-to-smoke-only');
});

test('yield gate keeps the pre-filter when it averts enough', () => {
  const results = [
    { decision: 'FAIL-SMOKE', avertsIosCall: true },
    { decision: 'FAIL-SMOKE', avertsIosCall: true },
    { decision: 'PASS-SMOKE', avertsIosCall: false },
  ];
  assert.equal(evaluateYield(results).recommend, 'keep');
});
