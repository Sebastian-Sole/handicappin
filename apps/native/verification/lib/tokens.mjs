/**
 * Loads the generated design-token contract (`@handicappin/tokens`).
 *
 * The contrast gate must run against `packages/tokens/generated/tokens.ts` —
 * never hardcoded hex — so token drift during the port window re-grounds
 * automatically. The generated source is TypeScript; Node ≥ 22.18's default
 * type-stripping imports it directly with no build step (keeps the harness
 * $0-infra and reproducible). Same mechanism as the ks-digital reference.
 *
 * SHAPE NOTE (differs from ks): this contract is PER-MODE —
 *   tokens.colors.light / tokens.colors.dark   (flat name → hex maps)
 *   tokens.surfaces.light / tokens.surfaces.dark
 * plus semantic `spacing` (xs..5xl), the Tailwind `spacingScale`, `radii`,
 * `typography`, `shadows`, `fonts`. Gates that rate colours must therefore run
 * once per mode — use `colorModes()` below.
 */
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { MONOREPO_ROOT } from '../config.mjs';

const TOKENS_TS = join(MONOREPO_ROOT, 'packages/tokens/generated/tokens.ts');

let cached;

/** @returns {Promise<object>} the full `{ colors:{light,dark}, spacing, ... }` contract. */
export async function loadTokens() {
  if (!cached) {
    const mod = await import(pathToFileURL(TOKENS_TS).href);
    cached = mod.tokens;
  }
  return cached;
}

/** The colour modes the gates must each pass. */
export const COLOR_MODES = Object.freeze(['light', 'dark']);

/**
 * Per-mode colour maps as `[mode, flatHexMap]` entries — the iteration shape
 * the contrast gate and a11y matrix consume.
 * @param {object} tokens - from loadTokens()
 * @returns {Array<[string, Record<string,string>]>}
 */
export function colorModes(tokens) {
  return COLOR_MODES.map((mode) => [mode, tokens.colors[mode]]);
}
