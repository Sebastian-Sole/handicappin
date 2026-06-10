import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createScreenState,
  nextIterationDecision,
  recordIteration,
  applyStop,
  deltaHash,
  verifiedName,
  isVerified,
  createLoopState,
  nextPassDecision,
} from './loop-control.mjs';
import { CAPS } from '../config.mjs';

test('a screen that clears its red items flips to verified', () => {
  const st = createScreenState('index');
  recordIteration(st, { redItems: ['color'], visionCallsUsed: 2 });
  recordIteration(st, { redItems: [], visionCallsUsed: 2 });
  assert.equal(st.status, 'verified');
  assert.equal(nextIterationDecision(st).continue, false);
});

test('verified_ gating: a screen is only "done" under the verified_ prefix', () => {
  assert.equal(verifiedName('index'), 'verified_index');
  assert.equal(isVerified('verified_index'), true);
  assert.equal(isVerified('index'), false);
});

test('iteration cap halts the screen and escalates to a human', () => {
  const st = createScreenState('rounds');
  for (let i = 0; i < CAPS.ITERATION_CAP; i++)
    recordIteration(st, { redItems: ['spacing'], visionCallsUsed: 2 });
  const d = nextIterationDecision(st);
  assert.equal(d.continue, false);
  assert.match(d.reason, /iteration-cap/);
  applyStop(st, d);
  assert.equal(st.status, 'escalated');
});

test('no-progress detector halts when the same delta-set recurs N times', () => {
  const st = createScreenState('statistics');
  // Same recurring diff every iteration → no progress.
  for (let i = 0; i < CAPS.NO_PROGRESS_LIMIT; i++)
    recordIteration(st, { redItems: ['card_depth'], visionCallsUsed: 2 });
  const d = nextIterationDecision(st);
  assert.equal(d.continue, false);
  assert.match(d.reason, /no-progress/);
  applyStop(st, d);
  assert.equal(st.status, 'halted');
});

test('a SHRINKING delta-set is progress — the loop keeps going', () => {
  const st = createScreenState('calculators');
  recordIteration(st, { redItems: ['a', 'b', 'c'], visionCallsUsed: 2 });
  recordIteration(st, { redItems: ['a', 'b'], visionCallsUsed: 2 });
  recordIteration(st, { redItems: ['a'], visionCallsUsed: 2 });
  assert.equal(nextIterationDecision(st).continue, true);
});

test('per-screen vision-call cap = iteration_cap × quorum', () => {
  const st = createScreenState('dashboard');
  assert.equal(CAPS.VISION_CALLS_PER_SCREEN, CAPS.ITERATION_CAP * CAPS.QUORUM);
  // Burn the vision budget without finishing.
  for (let i = 0; i < CAPS.ITERATION_CAP; i++)
    recordIteration(st, { redItems: ['x'], visionCallsUsed: 2 });
  assert.ok(st.visionCalls >= CAPS.VISION_CALLS_PER_SCREEN);
});

test('budget cap stops the screen even if iterations remain', () => {
  const st = createScreenState('index');
  st.spentUSD = st.budgetCapUSD; // simulate budget exhausted
  const d = nextIterationDecision(st);
  assert.equal(d.continue, false);
  assert.match(d.reason, /budget-cap/);
});

test('delta-hash is stable regardless of red-item order (good cache key)', () => {
  assert.equal(deltaHash(['b', 'a']), deltaHash(['a', 'b']));
  assert.notEqual(deltaHash(['a']), deltaHash(['a', 'b']));
});

test('total-pass ceiling halts the WHOLE loop, not just one screen', () => {
  const loop = createLoopState();
  loop.passes = CAPS.TOTAL_PASS_CEILING;
  const states = [createScreenState('index')]; // still iterating
  const d = nextPassDecision(loop, states);
  assert.equal(d.continue, false);
  assert.match(d.reason, /total-pass-ceiling/);
});

test('per-screen acceptance: one escalated screen does not block a verified one', () => {
  const a = createScreenState('index');
  recordIteration(a, { redItems: [] }); // verified
  const b = createScreenState('rounds');
  b.status = 'escalated';
  const loop = createLoopState();
  const d = nextPassDecision(loop, [a, b]);
  // both terminal (verified + escalated) → loop ends cleanly, a stayed green.
  assert.equal(d.continue, false);
  assert.equal(a.status, 'verified');
});
