/**
 * Token-contrast gate (WCAG 1.4.3 / 1.4.11) — DETERMINISTIC, build-time, runs
 * in the cheap pre-filter tier.
 *
 * This REPLACES axe-core's 1.4.3, which has NO React Native equivalent (it
 * silently vanishes in the port). Vision-judging contrast from a screenshot is
 * unreliable; computing the ratio from `@handicappin/tokens` resolved hex is
 * exact and more trustworthy.
 *
 * The token contract is PER-MODE (colors.light / colors.dark), so the gate is
 * run once per mode (see run-harness.mjs); pass the mode in `opts.mode` so the
 * waiver ledger below can match.
 *
 * Thresholds (WCAG 2.1 AA, per the repo a11y rules):
 *   - normal text:                 ≥ 4.5:1
 *   - large text (≥24px / ≥18.66px bold) and load-bearing UI / borders: ≥ 3:1
 *   - decorative dividers:         EXEMPT (e.g. border #d9e0dc on #f9fafa = 1.28:1)
 *
 * The pairings below were spot-validated against the generated tokens on
 * 2026-06-10; contrast-gate.test.mjs freezes those exact ratios so token drift
 * is caught. Screen-specific pairings come from each rubric's
 * `color_tokens.pairings_used`.
 */
import { contrastRatio, round2 } from '../lib/color.mjs';

export const THRESHOLD = Object.freeze({ NORMAL: 4.5, LARGE_OR_UI: 3.0 });

/**
 * The frozen pairing set (token names from the generated contract).
 * `kind`: 'normal' | 'large' | 'ui' | 'decorative'.
 * Decorative dividers are exempt — they are NOT failures, but flag any used as
 * the SOLE bound of a control (1.4.11).
 */
export const FROZEN_PAIRINGS = Object.freeze([
  { id: 'body-on-page', fg: 'foreground', bg: 'background', kind: 'normal' },
  { id: 'text-on-primary', fg: 'primary-foreground', bg: 'primary', kind: 'normal' },
  { id: 'body-on-card', fg: 'card-foreground', bg: 'card', kind: 'normal' },
  { id: 'muted-on-card', fg: 'muted-foreground', bg: 'card', kind: 'normal' },
  { id: 'muted-on-page', fg: 'muted-foreground', bg: 'background', kind: 'normal' },
  { id: 'secondary-chip', fg: 'secondary-foreground', bg: 'secondary', kind: 'normal' },
  { id: 'destructive-on-page', fg: 'destructive', bg: 'background', kind: 'normal' },
  { id: 'accent-chip', fg: 'accent-foreground', bg: 'accent', kind: 'normal' },
  // border #d9e0dc on #f9fafa = 1.28:1 — decorative divider, exempt.
  { id: 'card-border-on-page', fg: 'border', bg: 'background', kind: 'decorative' },
]);

/**
 * KNOWN sub-threshold pairings — the accept-the-diff ledger for token contrast.
 *
 * Parity comes first: the native port mirrors the WEB tokens 1:1 and must not
 * "fix" a token to satisfy this gate (that would be a self-inflicted parity
 * regression). A pre-existing web-side contrast miss is therefore WAIVED here
 * (reported, never silently dropped) and tracked for a web-side token fix —
 * after which the generated contract changes and this entry MUST be deleted.
 *
 * Each waiver is exact-match on (mode, id) and freezes the measured ratio so a
 * further regression past the recorded number still fails the gate.
 */
export const KNOWN_SUBTHRESHOLD = Object.freeze([
  // EMPTY — the one waiver this ledger ever held (dark text-on-primary at
  // 4.27:1) was burned down by the web-side palette fix: dark --primary
  // lightened and --primary-foreground flipped dark, landing at 5.31:1.
]);

function thresholdFor(kind) {
  if (kind === 'decorative') return null; // exempt
  return kind === 'normal' ? THRESHOLD.NORMAL : THRESHOLD.LARGE_OR_UI;
}

function waiverFor(mode, id, ratio) {
  const w = KNOWN_SUBTHRESHOLD.find((k) => k.mode === mode && k.id === id);
  // The waiver only covers the FROZEN ratio (±rounding) — a regression below
  // the recorded number is a new failure, not a waived one.
  return w && ratio >= w.frozenRatio ? w : null;
}

/**
 * Evaluate one pairing against a flat resolved token colour map (one mode).
 * @param {{id:string,fg:string,bg:string,kind:string}} pairing
 * @param {Record<string,string>} colors - resolved hex map for ONE mode
 * @param {{mode?:string}} [opts]
 */
export function evaluatePairing(pairing, colors, opts = {}) {
  const mode = opts.mode ?? 'light';
  const fgHex = colors[pairing.fg];
  const bgHex = colors[pairing.bg];
  if (!fgHex || !bgHex) {
    throw new Error(
      `contrast-gate: unknown token in pairing ${pairing.id} (${pairing.fg}/${pairing.bg})`,
    );
  }
  const ratio = round2(contrastRatio(fgHex, bgHex));
  const threshold = thresholdFor(pairing.kind);
  const meets = threshold === null ? true : ratio >= threshold;
  const waiver = !meets ? waiverFor(mode, pairing.id, ratio) : null;
  return {
    id: pairing.id,
    mode,
    fg: `${pairing.fg} ${fgHex}`,
    bg: `${pairing.bg} ${bgHex}`,
    ratio,
    threshold,
    kind: pairing.kind,
    pass: meets || waiver !== null,
    exempt: threshold === null,
    waived: waiver !== null,
    ...(waiver ? { waiverReason: waiver.reason } : {}),
  };
}

/**
 * Run the gate over a set of pairings for ONE colour mode.
 * @param {Record<string,string>} colors - flat resolved hex map (one mode)
 * @param {Array} [pairings]
 * @param {{mode?:string}} [opts] - mode name for waiver matching ('light' default)
 * @returns {{ pass: boolean, results: object[], failures: object[], waived: object[] }}
 */
export function runContrastGate(colors, pairings = FROZEN_PAIRINGS, opts = {}) {
  const results = pairings.map((p) => evaluatePairing(p, colors, opts));
  const failures = results.filter((r) => !r.pass);
  const waived = results.filter((r) => r.waived);
  return { pass: failures.length === 0, results, failures, waived };
}
