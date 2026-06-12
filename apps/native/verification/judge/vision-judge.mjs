/**
 * Anthropic vision judge — the live `judge(prompt, images, pass)` stage the
 * orchestrator injects (run-harness.mjs CLI path).
 *
 * ks left this stage unwired (NO_JUDGE → PENDING_HUMAN_SIGN_OFF); here it is
 * wired to the Claude API via @anthropic-ai/sdk. Model id comes from
 * config.JUDGE.MODEL (default claude-sonnet-4-6, override with
 * ANTHROPIC_MODEL). Two independent passes of this judge form the quorum
 * (judge/quorum.mjs).
 *
 * Degrades honestly, never crashes the harness:
 *   - no ANTHROPIC_API_KEY  → createVisionJudge() returns null and the caller
 *     logs a clear message; the loop pauses on PENDING_HUMAN_SIGN_OFF;
 *   - API/parse error       → the judgment is null (same human-pause path),
 *     with the error recorded on judge.lastError for the run log.
 */
import Anthropic from '@anthropic-ai/sdk';
import { JUDGE } from '../config.mjs';

/** Clear operator message used when the key is absent. */
export const NO_KEY_MESSAGE =
  'ANTHROPIC_API_KEY not set — vision judge disabled; quorum skipped, screen pauses on PENDING_HUMAN_SIGN_OFF. Export the key to enable the judge.';

const toImageBlock = (bytes) => ({
  type: 'image',
  source: {
    type: 'base64',
    media_type: 'image/png',
    data: Buffer.from(bytes).toString('base64'),
  },
});

/** Pull the JSON object out of the model text (tolerates ```json fences). */
export function parseJudgment(text) {
  const stripped = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  const start = stripped.indexOf('{');
  const end = stripped.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('no JSON object in judge reply');
  const j = JSON.parse(stripped.slice(start, end + 1));
  if (j.overall !== 'PASS' && j.overall !== 'FAIL') {
    throw new Error(`judge reply missing overall PASS|FAIL: ${j.overall}`);
  }
  return j;
}

/**
 * Create the judge stage, or null when no API key is configured.
 *
 * @param {object} [opts]
 * @param {string} [opts.model]  - overrides config.JUDGE.MODEL
 * @param {object} [opts.client] - injectable Anthropic-compatible client (tests)
 * @returns {null | ((prompt:string, images:{iosBytes:Buffer,webBytes:Buffer}, pass:number) => Promise<object|null>)}
 */
export function createVisionJudge(opts = {}) {
  if (!opts.client && !process.env.ANTHROPIC_API_KEY) return null;

  const client = opts.client ?? new Anthropic(); // reads ANTHROPIC_API_KEY from env
  const model = opts.model ?? JUDGE.MODEL;

  /** One independent judgment. `pass` (1|2) is logged for the quorum trail. */
  const judge = async (prompt, images, pass = 1) => {
    try {
      const response = await client.messages.create({
        model,
        max_tokens: JUDGE.MAX_TOKENS,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: `Quorum pass ${pass} of 2.` },
              toImageBlock(images.iosBytes), // candidate first…
              toImageBlock(images.webBytes), // …web reference second (in-prompt every iteration)
              { type: 'text', text: prompt },
            ],
          },
        ],
      });
      const text = response.content
        .filter((b) => b.type === 'text')
        .map((b) => b.text)
        .join('\n');
      return parseJudgment(text);
    } catch (err) {
      // APIError (auth, rate limit, overload) or a malformed reply — record and
      // degrade to the human-sign-off path instead of crashing the loop.
      judge.lastError =
        err instanceof Anthropic.APIError
          ? `Anthropic API ${err.status}: ${err.message}`
          : String(err?.message ?? err);
      return null;
    }
  };
  judge.model = model;
  judge.lastError = null;
  return judge;
}
