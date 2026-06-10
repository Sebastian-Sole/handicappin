/**
 * Vision-verdict cache (ported from the ks-digital reference).
 *
 * Key = hash(iOS_capture_bytes + web_reference_bytes + rubric_version +
 * judge_model). Identical capture → no re-call: a re-run after a no-op, or
 * after an UNRELATED screen changed, must not re-pay for unchanged screens.
 * A `rubric_version` change OR a judge-model change (config.JUDGE.MODEL /
 * ANTHROPIC_MODEL) changes the key and invalidates the cache AND the
 * calibration together — exactly the intended coupling.
 *
 * On-disk JSON under artifacts/verdict-cache/, so a live re-run in front of
 * evaluators is instant for unchanged screens. $0 infra.
 */
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, readFile as rf } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { CACHE_DIR, RUBRIC_VERSION, JUDGE } from '../config.mjs';

/**
 * Compute the cache key from the two image buffers + rubric version (+ judge
 * model id — defaults to the configured judge so a model swap invalidates).
 * @param {Buffer} iosBytes
 * @param {Buffer} webBytes
 * @param {object} [opts]
 * @returns {string} hex sha256
 */
export function verdictKey(iosBytes, webBytes, opts = {}) {
  const rubricVersion = opts.rubricVersion ?? RUBRIC_VERSION;
  const judgeModel = opts.judgeModel ?? JUDGE.MODEL;
  return createHash('sha256')
    .update(iosBytes)
    .update(webBytes)
    .update(rubricVersion)
    .update(judgeModel)
    .digest('hex');
}

function cachePath(key) {
  return join(CACHE_DIR, `${key}.json`);
}

/** @returns {Promise<object|null>} cached verdict or null on miss. */
export async function getCachedVerdict(key) {
  const p = cachePath(key);
  if (!existsSync(p)) return null;
  return JSON.parse(await rf(p, 'utf8'));
}

/** Persist a verdict under its key. */
export async function putCachedVerdict(key, verdict) {
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(cachePath(key), `${JSON.stringify(verdict, null, 2)}\n`);
}

/**
 * Convenience: hash two image FILES (used by the orchestrator).
 * @returns {Promise<string>}
 */
export async function verdictKeyForFiles(iosPath, webPath, opts = {}) {
  const [ios, web] = await Promise.all([readFile(iosPath), readFile(webPath)]);
  return verdictKey(ios, web, opts);
}
