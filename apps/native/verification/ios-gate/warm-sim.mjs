/**
 * Warm-simulator capture wrapper (ported from the ks-digital reference) — the
 * iOS truth surface.
 *
 * Cold-boot is the expensive part, so we boot ONE simulator and keep it warm
 * across iterations: reuse the installed app, re-inject changed JS via Fast
 * Refresh / re-launch, and batch every screen's capture in one sim session per
 * pass. `screens/hour` is recorded by the loop from these timings.
 *
 * iOS sim is the SOLE equivalence truth. This module only
 * captures clean frames — the verdict is made by judge/ + the a11y/Maestro tiers.
 *
 * PRE-REQUISITE (quality gate, mirrors .maestro/README.md): the operator starts
 * the dev server + boots the app. This wrapper does NOT auto-start `expo` — an
 * auto-started server masks "does it actually launch" regressions. It boots the
 * SIM (cheap, idempotent) but expects the app to be installed/launched by the run.
 *
 * ImageMagick normalizes (crop status bar + resize) — never a verdict.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { SIM } from '../config.mjs';

const exec = promisify(execFile);

/** Status-bar crop height (pt→px ~ iPhone 17 Pro). Normalization only. */
const STATUS_BAR_PX = 144;

/** Resolve the booted simulator UDID for the configured device, or null. */
export async function bootedSimUdid() {
  try {
    const { stdout } = await exec('xcrun', ['simctl', 'list', 'devices', 'booted', '-j']);
    const data = JSON.parse(stdout);
    for (const runtime of Object.values(data.devices)) {
      for (const dev of runtime) {
        if (dev.state === 'Booted') return dev.udid;
      }
    }
  } catch {
    /* simctl unavailable — caller degrades gracefully */
  }
  return null;
}

/**
 * Ensure a warm simulator. Boots the configured device if nothing is booted.
 * Idempotent: a second call reuses the already-warm sim.
 * @returns {Promise<{udid:string|null, warm:boolean, note:string}>}
 */
export async function ensureWarmSim() {
  let udid = await bootedSimUdid();
  if (udid) return { udid, warm: true, note: 'reused already-booted sim' };
  try {
    await exec('xcrun', ['simctl', 'boot', SIM.device]);
    udid = await bootedSimUdid();
    return { udid, warm: false, note: `cold-booted ${SIM.device}` };
  } catch (err) {
    return { udid: null, warm: false, note: `no sim: ${err.message}` };
  }
}

/**
 * Capture a screenshot from the warm sim and normalize it with ImageMagick.
 * Returns the raw + normalized paths. Throws if no sim is available — the
 * orchestrator catches this and records "iOS gate unavailable" honestly.
 *
 * @param {string} screen
 * @param {string} outDir
 * @returns {Promise<{raw:string, normalized:string}>}
 */
export async function captureScreen(screen, outDir) {
  const udid = await bootedSimUdid();
  if (!udid) throw new Error('captureScreen: no booted simulator (start it first)');
  await mkdir(outDir, { recursive: true });
  const raw = join(outDir, `${screen}.raw.png`);
  const normalized = join(outDir, `${screen}.png`);
  await exec('xcrun', ['simctl', 'io', udid, 'screenshot', raw]);
  // Normalize ONLY: crop status bar, leave colour untouched (no verdict here).
  await exec('magick', [
    raw,
    '-gravity', 'North',
    '-chop', `0x${STATUS_BAR_PX}`,
    normalized,
  ]);
  return { raw, normalized };
}

/**
 * Native-vs-native self-regression pixel diff via Maestro `assertScreenshot`
 * semantics (95% threshold). RESERVED for native↔native only — web↔native never
 * pixel-match, so this is never the cross-surface verdict.
 */
export const SELF_REGRESSION_THRESHOLD = 0.95;
