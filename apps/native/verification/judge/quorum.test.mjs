import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  quorumVerdict,
  proposeVerdict,
  resolveSignoff,
  isVisuallyConverged,
  MODE,
} from './quorum.mjs';
import { verdictKey } from './verdict-cache.mjs';

const pass = {
  overall: 'PASS',
  items: { layout: true, color: true, type: true },
  glyph_rendering: true,
};

test('two agreeing PASS judgments → quorum PASS', () => {
  const q = quorumVerdict(pass, pass);
  assert.equal(q.verdict, 'PASS');
  assert.equal(q.splits.length, 0);
});

test('a split on one item counts as FAIL and is reported (re-iterate)', () => {
  const j2 = { ...pass, items: { ...pass.items, color: false } };
  const q = quorumVerdict(pass, j2);
  assert.equal(q.verdict, 'FAIL');
  assert.deepEqual(q.splits, ['color']);
  assert.equal(q.perItem.color.pass, false);
});

test('a glyph disagreement fails the screen (tofu is a first-class row)', () => {
  const j2 = { ...pass, glyph_rendering: false };
  const q = quorumVerdict(pass, j2);
  assert.equal(q.verdict, 'FAIL');
  assert.ok(q.splits.includes('glyph_rendering'));
});

test('human-in-the-loop: a PASS quorum still PAUSES for human sign-off', () => {
  const q = quorumVerdict(pass, pass);
  const rec = proposeVerdict('index', q, MODE.HUMAN);
  assert.equal(rec.status, 'PENDING_HUMAN_SIGN_OFF');
  assert.equal(rec.final_verdict, null);
  assert.equal(isVisuallyConverged(rec), false); // NOT converged on quorum alone
});

test('human path is reachable: resolving the sign-off converges the screen', () => {
  const q = quorumVerdict(pass, pass);
  let rec = proposeVerdict('index', q, MODE.HUMAN);
  rec = resolveSignoff(rec, 'PASS');
  assert.equal(rec.status, 'RESOLVED');
  assert.equal(rec.human_signoff, 'PASS');
  assert.equal(isVisuallyConverged(rec), true);
});

test('human can OVERRIDE a PASS quorum to FAIL (catches the ledger-rationalised regression)', () => {
  const q = quorumVerdict(pass, pass); // model says PASS…
  let rec = proposeVerdict('index', q, MODE.HUMAN);
  rec = resolveSignoff(rec, 'FAIL'); // …human sees the real regression
  assert.equal(rec.final_verdict, 'FAIL');
  assert.equal(isVisuallyConverged(rec), false);
});

test('autonomous mode (reachable) resolves on the quorum with no human pause', () => {
  const q = quorumVerdict(pass, pass);
  const rec = proposeVerdict('index', q, MODE.AUTONOMOUS);
  assert.equal(rec.status, 'RESOLVED');
  assert.equal(isVisuallyConverged(rec), true);
});

test('verdict cache key changes when rubric_version changes (invalidation)', () => {
  const ios = Buffer.from('ios-bytes');
  const web = Buffer.from('web-bytes');
  const k1 = verdictKey(ios, web, { rubricVersion: 'bring-up-v1' });
  const k2 = verdictKey(ios, web, { rubricVersion: 'bring-up-v2' });
  const same = verdictKey(ios, web, { rubricVersion: 'bring-up-v1' });
  assert.notEqual(k1, k2);
  assert.equal(k1, same); // identical inputs → identical key (cache hit)
});

test('verdict cache key changes when the judge model changes (model↔cache coupling)', () => {
  const ios = Buffer.from('a');
  const web = Buffer.from('b');
  assert.notEqual(
    verdictKey(ios, web, { judgeModel: 'claude-sonnet-4-6' }),
    verdictKey(ios, web, { judgeModel: 'claude-opus-4-6' }),
  );
});
