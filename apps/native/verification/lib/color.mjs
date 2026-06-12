/**
 * Pure WCAG colour math (no deps). Used by the deterministic token-contrast gate.
 *
 * Implements WCAG 2.1 relative luminance (1.4.3) exactly:
 *   https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 *   https://www.w3.org/TR/WCAG21/#dfn-contrast-ratio
 */

/** Parse #rgb / #rrggbb / #rrggbbaa → {r,g,b,a} in 0–255 (a in 0–1). */
export function parseHex(hex) {
  let h = String(hex).trim().replace(/^#/, '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (h.length === 6) h += 'ff';
  if (h.length !== 8 || /[^0-9a-fA-F]/.test(h)) {
    throw new Error(`Invalid hex colour: ${hex}`);
  }
  return {
    r: Number.parseInt(h.slice(0, 2), 16),
    g: Number.parseInt(h.slice(2, 4), 16),
    b: Number.parseInt(h.slice(4, 6), 16),
    a: Number.parseInt(h.slice(6, 8), 16) / 255,
  };
}

/** Linearise one 8-bit channel per the WCAG sRGB formula. */
function channelLuminance(c8) {
  const c = c8 / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance of an opaque colour. */
export function relativeLuminance(hex) {
  const { r, g, b } = parseHex(hex);
  return (
    0.2126 * channelLuminance(r) +
    0.7152 * channelLuminance(g) +
    0.0722 * channelLuminance(b)
  );
}

/**
 * Composite a (possibly translucent) foreground over an opaque background,
 * returning the resolved opaque hex. Most handicappin colour tokens are opaque,
 * but the tint/chip surface recipes and the `overlay` token are alpha
 * (#rrggbbaa) — handle them correctly so a translucent token can't silently
 * slip the gate.
 */
export function compositeOver(fgHex, bgHex) {
  const fg = parseHex(fgHex);
  const bg = parseHex(bgHex);
  const a = fg.a;
  const mix = (f, b) => Math.round(f * a + b * (1 - a));
  const toHex = (n) => n.toString(16).padStart(2, '0');
  return `#${toHex(mix(fg.r, bg.r))}${toHex(mix(fg.g, bg.g))}${toHex(mix(fg.b, bg.b))}`;
}

/** WCAG contrast ratio of foreground over background (composites alpha first). */
export function contrastRatio(fgHex, bgHex) {
  const fgOpaque = compositeOver(fgHex, bgHex);
  const l1 = relativeLuminance(fgOpaque);
  const l2 = relativeLuminance(bgHex);
  const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

/** Round to 2dp the way the frozen ratio tables are stated, for stable comparison. */
export function round2(n) {
  return Math.round(n * 100) / 100;
}
