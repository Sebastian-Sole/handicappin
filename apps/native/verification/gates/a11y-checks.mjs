/**
 * a11y / glyph check matrix — the RN-specific mechanisms the web suite
 * (eslint-plugin-jsx-a11y + axe-style tooling) CANNOT carry into the native
 * port. Ported from the ks-digital reference and adapted to handicappin.
 *
 * Each row maps a WCAG criterion to a NATIVE verification mechanism and a TIER:
 *   - 'deterministic' : computed/asserted in code now (contrast gate, glyph list);
 *   - 'maestro'       : asserted by a behavioral flow (.maestro/flows/);
 *   - 'voiceover'     : scripted manual VoiceOver pass, RECORDED in the run log.
 *
 * This is the single registry the orchestrator records per screen so an a11y
 * regression on the surface that counts (iOS) cannot silently slip. It does
 * NOT discharge WCAG 2.1 AA — it catches the highest-frequency regressions
 * per screen.
 */
import { runContrastGate } from './contrast-gate.mjs';

/**
 * Sheet/dialog surfaces that need the SF-1…SF-5 focus checklist. EMPTY today —
 * no sheet has been ported yet. Append the surface name the day a web dialog
 * (auth modals, round-add flow, filters, …) lands natively; the checklist is
 * mandatory per surface because RN bottom-sheets do NOT auto-focus/trap SR
 * focus on iOS.
 */
export const SHEET_SURFACES = Object.freeze([]);

/** The 5-item per-sheet focus checklist. */
export const SHEET_FOCUS_CHECKLIST = Object.freeze([
  { id: 'SF-1', desc: 'focus moves into the sheet on open' },
  { id: 'SF-2', desc: 'focus trapped while open (accessibilityViewIsModal iOS / no-hide-descendants Android)' },
  { id: 'SF-3', desc: 'ESC/drag-dismiss returns focus to the trigger' },
  { id: 'SF-4', desc: 'SR announces the sheet as a named dialog' },
  { id: 'SF-5', desc: 'background inert to touch and SR' },
]);

/**
 * Real token-gallery heading strings the glyph/no-tofu check asserts — every
 * Inter face the app bundles (400/500/600/700/800, lib/fonts.ts) is exercised
 * by the gallery's type ramp, so a fallback face shows here first.
 */
export const GLYPH_STRINGS = Object.freeze([
  'Token gallery',
  'Colors',
  'Typography',
  'Surfaces',
  'Spacing ramp',
]);

/**
 * The structured a11y matrix. `evaluator` is present only for deterministic
 * rows; the rest declare which Maestro flow / VoiceOver script verifies them.
 */
export const A11Y_MATRIX = Object.freeze([
  {
    id: 'contrast_1_4_3',
    wcag: '1.4.3',
    tier: 'deterministic',
    mechanism:
      'token-contrast gate against @handicappin/tokens, per colour mode (replaces axe-core)',
    // ctx.colors is the per-mode record { light: {...}, dark: {...} }.
    evaluator: (ctx) => {
      const perMode = Object.entries(ctx.colors).map(([mode, colors]) => ({
        mode,
        ...runContrastGate(colors, undefined, { mode }),
      }));
      return {
        pass: perMode.every((m) => m.pass),
        detail: perMode.flatMap((m) => m.failures.concat(m.waived)),
      };
    },
  },
  {
    id: 'name_role_value_4_1_2',
    wcag: '4.1.2',
    tier: 'maestro',
    mechanism:
      'accessibility-tree assert: every interactive node has non-empty label + correct role + exposed state',
    flow: 'all flows (accessible-name/testID selectors only)',
  },
  {
    id: 'touch_target_2_5_5',
    wcag: '2.5.5',
    tier: 'maestro',
    mechanism: 'element-bounds assert, hit-slop aware (touchable = visual + hitSlop ≥ 44×44)',
    flow: 'component-enforced when interactive components land + runtime bounds check',
  },
  {
    id: 'dynamic_type_1_4_4',
    wcag: '1.4.4',
    tier: 'maestro',
    mechanism: 'capture at default AND largest text size; no clipping/overlap in the type ramp',
    flow: 'dynamic-type capture variant (token gallery first)',
  },
  {
    id: 'reduce_motion_2_3_3',
    wcag: '2.3.3',
    tier: 'maestro',
    mechanism: 'splash/transitions honor AccessibilityInfo.isReduceMotionEnabled()',
    flow: 'reduce-motion variant (when animated screens land)',
  },
  {
    id: 'status_messages_4_1_3',
    wcag: '4.1.3',
    tier: 'maestro',
    mechanism:
      'announceForAccessibility (iOS) / accessibilityLiveRegion (Android) fires on async results',
    flow: 'pending — first data screen (round saved, stats loaded)',
  },
  {
    id: 'focus_after_nav_2_4_3',
    wcag: '2.4.3',
    tier: 'maestro',
    mechanism: 'setAccessibilityFocus(reactTag) moves focus to the new screen heading on mount',
    flow: 'navigation flows (when a second route lands)',
  },
  {
    id: 'bypass_blocks_2_4_1',
    wcag: '2.4.1',
    tier: 'n/a',
    mechanism: 'N/A on native — replaced by heading order + landmark nav (substitution documented)',
  },
  {
    id: 'forced_colors_2_4_7',
    wcag: '2.4.7',
    tier: 'voiceover',
    mechanism: 'focus/selection not color-only; optional capture under Increase Contrast / Smart Invert',
  },
  {
    id: 'lang_en_3_1_1',
    wcag: '3.1.1',
    tier: 'maestro',
    mechanism: 'expo-localization locale = en + correct glyph rendering of real headings',
    flow: 'smoke-token-gallery.yaml (heading asserts)',
  },
  {
    id: 'glyph_rendering',
    wcag: 'design-fidelity',
    tier: 'deterministic',
    mechanism:
      'no-tofu/.notdef at all bundled Inter weights (400–800) against real gallery headings',
    evaluator: (ctx) => {
      // The capture-hygiene gate already discards fallback-font frames; here we
      // record the required string set so the run log proves coverage.
      const covered = ctx.glyphsRendered ?? [];
      const missing = GLYPH_STRINGS.filter((s) => !covered.includes(s));
      return { pass: ctx.glyphsRendered ? missing.length === 0 : null, detail: { missing } };
    },
  },
  {
    id: 'sheet_focus_4_1_2_2_4_3',
    wcag: '4.1.2 / 2.4.3',
    tier: 'voiceover',
    mechanism:
      'SF-1…SF-5 checklist per sheet surface (RN sheets do not auto-focus/trap on iOS) — no surfaces yet',
    flow: 'per-sheet checklist + scripted VoiceOver pass (when SHEET_SURFACES is non-empty)',
  },
]);

/**
 * Build the per-screen a11y report. `screenA11y` is the screen's `a11y:` block
 * from its rubric YAML (drives which rows apply / are N/A on that screen).
 *
 * @param {object} ctx - { colors: {light,dark}, glyphsRendered?, screen, screenA11y? }
 * @returns {{ screen:string, rows:object[], deterministicPass:boolean, pending:string[] }}
 */
export function buildA11yReport(ctx) {
  const rows = A11Y_MATRIX.map((row) => {
    if (row.evaluator) {
      const { pass, detail } = row.evaluator(ctx);
      return { ...row, evaluator: undefined, status: pass === null ? 'PENDING' : pass ? 'PASS' : 'FAIL', detail };
    }
    return { ...row, status: row.tier === 'n/a' ? 'N/A' : 'PENDING-LIVE' };
  });
  const deterministic = rows.filter((r) => r.tier === 'deterministic');
  return {
    screen: ctx.screen,
    rows,
    deterministicPass: deterministic.every((r) => r.status === 'PASS' || r.status === 'PENDING'),
    pending: rows.filter((r) => String(r.status).startsWith('PENDING')).map((r) => r.id),
  };
}
