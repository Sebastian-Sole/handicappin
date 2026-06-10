/**
 * Vision-judge wiring test — hermetic. Never calls the Anthropic API: the
 * no-key path is exercised by clearing the env var, the happy/error paths by
 * injecting a fake client.
 *
 *   node --test verification/judge/vision-judge.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createVisionJudge, parseJudgment, NO_KEY_MESSAGE } from './vision-judge.mjs';
import { JUDGE } from '../config.mjs';

const images = { iosBytes: Buffer.from('ios'), webBytes: Buffer.from('web') };

const fakeClient = (text) => ({
  messages: {
    async create(req) {
      fakeClient.lastRequest = req;
      return { content: [{ type: 'text', text }] };
    },
  },
});

test('no ANTHROPIC_API_KEY → judge is null (degrade to human sign-off, no crash)', () => {
  const saved = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  try {
    assert.equal(createVisionJudge(), null);
    assert.match(NO_KEY_MESSAGE, /ANTHROPIC_API_KEY/);
    assert.match(NO_KEY_MESSAGE, /PENDING_HUMAN_SIGN_OFF/);
  } finally {
    if (saved !== undefined) process.env.ANTHROPIC_API_KEY = saved;
  }
});

test('judge sends both images + prompt and parses the JSON judgment', async () => {
  const reply = '{"overall":"PASS","items":{"layout_structure":true},"glyph_rendering":true,"primary_reason":"equivalent","confidence":0.9}';
  const client = fakeClient(reply);
  const judge = createVisionJudge({ client });
  const j = await judge('PROMPT TEXT', images, 1);
  assert.equal(j.overall, 'PASS');
  assert.equal(j.items.layout_structure, true);
  const content = fakeClient.lastRequest.messages[0].content;
  assert.equal(content.filter((b) => b.type === 'image').length, 2); // candidate + reference
  assert.ok(content.some((b) => b.type === 'text' && b.text === 'PROMPT TEXT'));
  assert.equal(fakeClient.lastRequest.model, JUDGE.MODEL); // env-overridable default
});

test('default model id is claude-sonnet-4-6 unless ANTHROPIC_MODEL overrides', () => {
  // JUDGE.MODEL is frozen at import time; assert the documented default shape.
  const expected = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6';
  assert.equal(JUDGE.MODEL, expected);
});

test('parseJudgment tolerates ```json fences and rejects garbage', () => {
  const fenced = '```json\n{"overall":"FAIL","items":{},"glyph_rendering":false}\n```';
  assert.equal(parseJudgment(fenced).overall, 'FAIL');
  assert.throws(() => parseJudgment('no json here'));
  assert.throws(() => parseJudgment('{"overall":"MAYBE"}'));
});

test('a malformed model reply degrades to null (human sign-off), not a crash', async () => {
  const judge = createVisionJudge({ client: fakeClient('I think it looks fine!') });
  const j = await judge('prompt', images, 2);
  assert.equal(j, null);
  assert.match(judge.lastError, /JSON|overall/i);
});
