/**
 * Builds the cross-surface vision-judge prompt for a screen.
 *
 * Ported from the ks-digital reference; ks read a frozen template from its
 * docs/ fidelity dir — handicappin has no such dir, so the template is INLINE
 * here (still frozen: changing it should bump RUBRIC_VERSION, which
 * invalidates the verdict cache). The per-screen rubric YAML lives at
 * verification/rubrics/<screen>.yaml.
 *
 * Invariants baked in:
 *   - the frozen rubric is the scoring target (not holistic vibes);
 *   - the accept-the-diff ledger (A-1..A-7) is fed as "ACCEPT, never chase";
 *   - the web reference screenshot is in-prompt EVERY iteration (anti-drift anchor);
 *   - the judge is told the RNW #1604 false-FAIL is expected;
 *   - the output contract is the strict JSON the quorum (judge/quorum.mjs) parses.
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { RUBRICS_DIR } from '../config.mjs';

/**
 * Accept-the-diff ledger — platform differences between the Next.js web app
 * and the React Native port that are ACCEPTED, never chased. Adapted from the
 * ks C-1..C-9 ledger to handicappin's stack (Tailwind v4 utilities → NativeWind,
 * shadcn/Radix → RN primitives).
 */
export const ACCEPT_LEDGER = `- A-1 multi-layer CSS box-shadows flatten to single-layer RN shadows — residual softness below threshold.
- A-2 backdrop-blur / glassmorphism — flattened to solid or omitted (no RN equivalent).
- A-3 hover micro-feedback — replaced with press states; not diffed.
- A-4 sub-pixel gap / flex rounding — below threshold.
- A-5 CSS gradients/sheens simplified to solid fills where RN lacks the primitive.
- A-6 scroll physics / snap offsets — platform-native feel reads equivalent.
- A-7 browser chrome concerns (sticky URL bar, :has(), @supports plumbing) — replaced by expo-status-bar + SafeAreaView.
- RNW#1604 flex:0 collapses on web but renders native — a known false-FAIL; do NOT fail the native candidate for it.`;

/**
 * The frozen judge prompt template. {{SCREEN}}, {{ACCEPT_LEDGER}} and
 * {{RUBRIC_YAML}} are filled per screen; the two screenshots (iOS capture
 * first, web reference second) are attached as images by the judge caller.
 */
export const PROMPT_TEMPLATE = `You are a strict visual-equivalence judge for the handicappin app's web→native port.

You will receive TWO screenshots:
1. The CANDIDATE: the React Native screen "{{SCREEN}}" captured on the iOS simulator.
2. The REFERENCE: the same screen rendered by the Next.js web app at a 402×874 phone viewport.

Score the candidate against the frozen rubric below — item by item, booleans only.
Judge equivalence of structure, design tokens (color roles, spacing rhythm,
type hierarchy), and component presence. Do NOT pixel-match: platform-native
rendering differences listed in the ACCEPT ledger are accepted and must never
cause a FAIL.

ACCEPT — never chase these diffs:
{{ACCEPT_LEDGER}}

FROZEN RUBRIC ({{SCREEN}}):
---
{{RUBRIC_YAML}}
---

Also assess glyph_rendering: every visible string renders in the intended face
(Inter); any tofu/.notdef box, fallback serif, or missing weight is false.

Respond with ONLY a JSON object, no prose, matching exactly:
{
  "overall": "PASS" | "FAIL",
  "items": { "<rubric_item_id>": true | false, ... },
  "glyph_rendering": true | false,
  "primary_reason": "<one sentence — the single most important deviation, or 'equivalent'>",
  "confidence": <0.0-1.0>
}`;

/** @returns {Promise<string>} the filled judge prompt for `screen`. */
export async function buildJudgePrompt(screen) {
  const rubric = await readFile(join(RUBRICS_DIR, `${screen}.yaml`), 'utf8');
  return PROMPT_TEMPLATE.replaceAll('{{SCREEN}}', screen)
    .replaceAll('{{ACCEPT_LEDGER}}', ACCEPT_LEDGER)
    .replaceAll('{{RUBRIC_YAML}}', rubric.trim());
}
