import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isCaptureReady,
  waitForCleanFrame,
  FONTS_READY_TEST_ID,
  DATA_SETTLED_LABEL,
  SKELETON_LABEL,
  FALLBACK_FONT_MARKER,
} from './capture-hygiene.mjs';

const clean = {
  testIds: [FONTS_READY_TEST_ID],
  labels: [DATA_SETTLED_LABEL, 'Token gallery'],
};

test('a clean, font-ready + data-settled frame is capture-ready', () => {
  assert.deepEqual(isCaptureReady(clean), { ready: true, reasons: [] });
});

test('a skeleton frame is discarded (would have wasted a vision call)', () => {
  const r = isCaptureReady({
    testIds: [FONTS_READY_TEST_ID],
    labels: [SKELETON_LABEL],
  });
  assert.equal(r.ready, false);
  assert.ok(r.reasons.includes('skeleton-in-tree'));
  assert.ok(r.reasons.includes('data-not-settled'));
});

test('a fallback-font (tofu) frame is discarded before the judge sees it', () => {
  const r = isCaptureReady({
    testIds: [FONTS_READY_TEST_ID, FALLBACK_FONT_MARKER],
    labels: [DATA_SETTLED_LABEL],
  });
  assert.equal(r.ready, false);
  assert.ok(r.reasons.includes('fallback-font-detected'));
});

test('fonts-not-ready frame is discarded', () => {
  const r = isCaptureReady({ testIds: [], labels: [DATA_SETTLED_LABEL] });
  assert.equal(r.ready, false);
  assert.ok(r.reasons.includes('fonts-not-ready'));
});

test('waitForCleanFrame resolves once the tree settles (no oscillation)', async () => {
  // Simulate a loading screen: skeleton for 2 polls, then settled.
  let poll = 0;
  const readTree = async () => {
    poll++;
    if (poll < 3)
      return { testIds: [FONTS_READY_TEST_ID], labels: [SKELETON_LABEL] };
    return clean;
  };
  const res = await waitForCleanFrame(readTree, {
    timeoutMs: 5000,
    intervalMs: 1,
    sleep: async () => {},
  });
  assert.equal(res.ready, true);
  assert.equal(res.attempts, 3);
});

test('waitForCleanFrame times out (and reports why) on a stuck skeleton', async () => {
  const readTree = async () => ({
    testIds: [FONTS_READY_TEST_ID],
    labels: [SKELETON_LABEL],
  });
  let t = 0;
  const res = await waitForCleanFrame(readTree, {
    timeoutMs: 10,
    intervalMs: 5,
    sleep: async (ms) => {
      t += ms;
    },
    now: () => t,
  });
  assert.equal(res.ready, false);
  assert.ok(res.reasons.includes('skeleton-in-tree'));
});
