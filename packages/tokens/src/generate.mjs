#!/usr/bin/env node
/**
 * @handicappin/tokens — design-token generator.
 *
 * Ported from the ks-digital reference implementation and adapted for this
 * repo's CSS shape. Reads app/globals.css plus the utility layers
 * (app/styles/utilities/typography.css, surfaces.css) — the design-system
 * source of truth, referenced READ-ONLY — with a real CSS AST (postcss),
 * resolves var() indirection, calc(var(--radius) ± Npx), and
 * color-mix(in oklab, <token> N%, transparent), and emits native-consumable
 * artifacts into ./generated:
 *
 *   1. tokens.ts          — framework-agnostic typed token object with
 *                           per-mode (light/dark) colors and surfaces.
 *   2. native-global.css  — preview of the future native-app NativeWind v5
 *                           entry (resolved hex, px units, Inter faces).
 *                           Becomes apps/native/global.css in Phase 2.
 *
 * Adaptations vs the ks-digital generator (kept deliberately close so future
 * fixes port both ways):
 *   - dual themes: `:root` (light) + `.dark` instead of one [data-theme] block
 *   - typography parsed from `@utility text-*` blocks (separate file), not
 *     `.text-*` rules in @layer components
 *   - surfaces: `@utility` recipes built on color-mix() are resolved to
 *     per-mode hex8 (color-mix over transparent == base color at N% alpha)
 *   - semantic spacing ramp (--spacing-xs..5xl), --size-*, --breakpoint-*,
 *     --tracking-* are first-class token sections
 *   - radius calc is additive (calc(var(--radius) ± Npx)), not multiplicative
 *   - em letter-spacing converted to px against each ramp entry's font size
 *
 * Pure helpers are exported for unit testing. `main()` runs the CLI.
 * Do NOT hand-edit the generated files; run `pnpm generate:theme`.
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "postcss";
import { nativeFaceFor } from "./font-faces.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(__dirname, "..");

// ---------------------------------------------------------------------------
// Small numeric / string utilities
// ---------------------------------------------------------------------------

const round2 = (n) => Math.round(n * 100) / 100;
/** rem needs finer precision (0.525, 1.225, …) than the 2-decimal px granularity. */
const round5 = (n) => Math.round(n * 1e5) / 1e5;

/** Unit-aware rem/em parse: "0.875rem" -> 0.875, "16px" -> 1 (converted at
    16px/rem). Without the px branch a px-valued token would be read as rem
    and silently inflate 16x. */
export function parseRem(value) {
  const v = String(value).trim();
  const n = parseFloat(v);
  return /^-?[\d.]+px$/.test(v) ? n / 16 : n;
}

/** "1px" | "-12px" | "0.5rem" | "0" -> number (px), rem-aware. */
export function parseLengthToPx(token, remBasePx = 16) {
  const v = String(token).trim();
  const m = v.match(/^(-?[\d.]+)rem$/);
  if (m) return round2(parseFloat(m[1]) * remBasePx);
  return parseFloat(v);
}

/** Split a comma-separated value on top-level commas only (ignores commas inside parens). */
export function splitTopLevelCommas(str) {
  const out = [];
  let depth = 0;
  let buf = "";
  for (const ch of String(str)) {
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      out.push(buf.trim());
      buf = "";
    } else {
      buf += ch;
    }
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}

// ---------------------------------------------------------------------------
// Colour conversion
// ---------------------------------------------------------------------------

function oklabToLinearSrgb(L, a, b) {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

function isInSrgbGamut(r, g, b) {
  const eps = 0.001;
  return (
    r >= -eps && r <= 1 + eps && g >= -eps && g <= 1 + eps && b >= -eps && b <= 1 + eps
  );
}

/** oklch(L C H) -> "#rrggbb" with chroma-reduction gamut mapping (browser-like). */
export function oklchToHex(l, c, h) {
  const hRad = (h * Math.PI) / 180;
  const toSrgb = (x) =>
    x >= 0.0031308 ? 1.055 * Math.pow(x, 1 / 2.4) - 0.055 : 12.92 * x;
  let lo = 0;
  let hi = c;
  let bestRgb = oklabToLinearSrgb(l, c * Math.cos(hRad), c * Math.sin(hRad));
  if (!isInSrgbGamut(...bestRgb)) {
    for (let i = 0; i < 20; i++) {
      const mid = (lo + hi) / 2;
      const rgb = oklabToLinearSrgb(l, mid * Math.cos(hRad), mid * Math.sin(hRad));
      if (isInSrgbGamut(...rgb)) {
        lo = mid;
        bestRgb = rgb;
      } else {
        hi = mid;
      }
    }
  }
  const ch = (v) =>
    Math.round(Math.min(255, Math.max(0, toSrgb(v) * 255)))
      .toString(16)
      .padStart(2, "0");
  return "#" + ch(bestRgb[0]) + ch(bestRgb[1]) + ch(bestRgb[2]);
}

const alphaToHex = (a) =>
  Math.round(a * 255)
    .toString(16)
    .padStart(2, "0");

/**
 * Convert any CSS colour value to an RN-consumable hex string.
 * Handles #hex (pass-through), oklch() incl. alpha, and rgb()/rgba() in both
 * comma and space syntax. Unknown formats pass through unchanged.
 */
export function cssColorToHex(value) {
  const v = String(value).trim();

  if (v.startsWith("#")) return v.toLowerCase();

  const oklch = v.match(
    /^oklch\(\s*([\d.]+%?)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+%?))?\s*\)$/i,
  );
  if (oklch) {
    const l = oklch[1].endsWith("%") ? parseFloat(oklch[1]) / 100 : parseFloat(oklch[1]);
    const hex = oklchToHex(l, parseFloat(oklch[2]), parseFloat(oklch[3]));
    if (oklch[4] != null) {
      const a = oklch[4].endsWith("%") ? parseFloat(oklch[4]) / 100 : parseFloat(oklch[4]);
      return hex + alphaToHex(a);
    }
    return hex;
  }

  const rgb = v.match(/^rgba?\(([^)]+)\)$/i);
  if (rgb) {
    const parts = rgb[1].split(/[\s,/]+/).filter(Boolean);
    const [r, g, b, a] = parts;
    const toHex = (n) => Math.round(parseFloat(n)).toString(16).padStart(2, "0");
    let hex = "#" + toHex(r) + toHex(g) + toHex(b);
    if (a != null) {
      const alpha = a.endsWith("%") ? parseFloat(a) / 100 : parseFloat(a);
      hex += alphaToHex(alpha);
    }
    return hex;
  }

  return v;
}

/** Apply an extra alpha factor to a hex color (#rrggbb or #rrggbbaa). */
export function hexWithAlpha(hex, alpha) {
  const v = String(hex).trim().toLowerCase();
  const m = v.match(/^#([0-9a-f]{6})([0-9a-f]{2})?$/);
  if (!m) return v;
  const existing = m[2] != null ? parseInt(m[2], 16) / 255 : 1;
  return "#" + m[1] + alphaToHex(existing * alpha);
}

// ---------------------------------------------------------------------------
// Value resolvers
// ---------------------------------------------------------------------------

const VAR_RE = /^var\(\s*(--[\w-]+)\s*(?:,\s*([\s\S]+))?\)$/;

/**
 * Resolve a --color-* value to hex against one mode's theme vars.
 *   var(--primary)  -> look up the :root / .dark block.
 *   oklch(...)      -> convert.
 * Returns null if a var() cannot be resolved (no theme value, no fallback).
 */
export function resolveColorValue(value, themeVars, depth = 0) {
  if (depth > 8) return null; // var() chain too deep — treat as unresolvable
  const v = String(value).trim();
  const varMatch = v.match(VAR_RE);
  if (varMatch) {
    const ref = varMatch[1];
    // A theme value may itself be a var() (token aliasing) — recurse so the
    // chain bottoms out at a literal color instead of feeding "var(--x)"
    // into cssColorToHex.
    if (themeVars.has(ref)) return resolveColorValue(themeVars.get(ref), themeVars, depth + 1);
    if (varMatch[2]) return resolveColorValue(varMatch[2].trim(), themeVars, depth + 1);
    return null;
  }
  return cssColorToHex(v);
}

// This repo's radius scale is additive: calc(var(--radius) - 4px) etc.
// The ks-digital multiplicative forms are kept for portability.
const CALC_ADD = /^calc\(\s*var\(\s*--radius\s*\)\s*([+-])\s*([\d.]+)px\s*\)$/;
const CALC_MUL_A = /^calc\(\s*var\(\s*--radius\s*\)\s*\*\s*([\d.]+)\s*\)$/;
const CALC_MUL_B = /^calc\(\s*([\d.]+)\s*\*\s*var\(\s*--radius\s*\)\s*\)$/;

/**
 * Resolve a --radius-* value against the radius base (rem).
 * Handles literal px/rem, bare var(--radius), calc(var(--radius) ± Npx),
 * and calc(var(--radius) * N) in either factor order.
 * Returns { px, rem } or null.
 */
export function resolveRadiusValue(value, radiusBaseRem, remBasePx = 16) {
  const v = String(value).trim();

  let m = v.match(/^(-?[\d.]+)px$/);
  if (m) {
    const px = parseFloat(m[1]);
    return { px, rem: round5(px / remBasePx) };
  }

  m = v.match(/^([\d.]+)rem$/);
  if (m) {
    const rem = parseFloat(m[1]);
    return { px: round2(rem * remBasePx), rem: round5(rem) };
  }

  if (/^var\(\s*--radius\s*\)$/.test(v)) {
    return { px: round2(radiusBaseRem * remBasePx), rem: round5(radiusBaseRem) };
  }

  m = v.match(CALC_ADD);
  if (m) {
    const deltaPx = (m[1] === "-" ? -1 : 1) * parseFloat(m[2]);
    const px = round2(radiusBaseRem * remBasePx + deltaPx);
    return { px, rem: round5(px / remBasePx) };
  }

  m = v.match(CALC_MUL_A) || v.match(CALC_MUL_B);
  if (m) {
    const rem = radiusBaseRem * parseFloat(m[1]);
    return { px: round2(rem * remBasePx), rem: round5(rem) };
  }

  return null;
}

/** "3rem" | "48px" -> { px, rem } against remBasePx. */
export function parseRemPx(value, remBasePx = 16) {
  const v = String(value).trim();
  let m = v.match(/^(-?[\d.]+)rem$/);
  if (m) {
    const rem = parseFloat(m[1]);
    return { px: round2(rem * remBasePx), rem: round5(rem) };
  }
  m = v.match(/^(-?[\d.]+)px$/);
  if (m) {
    const px = parseFloat(m[1]);
    return { px, rem: round5(px / remBasePx) };
  }
  const n = parseFloat(v);
  return { px: n, rem: round5(n / remBasePx) };
}

// --tracking-*: calc(var(--tracking-normal) ± Nem) | var(--tracking-normal) | 0.025em
const TRACK_CALC = /^calc\(\s*var\(\s*--tracking-normal\s*\)\s*([+-])\s*([\d.]+)em\s*\)$/;

/** Resolve a --tracking-* value to an em number against the tracking base. */
export function resolveTrackingValue(value, trackingBaseEm) {
  const v = String(value).trim();
  if (/^var\(\s*--tracking-normal\s*\)$/.test(v)) return round5(trackingBaseEm);
  let m = v.match(TRACK_CALC);
  if (m) {
    const delta = (m[1] === "-" ? -1 : 1) * parseFloat(m[2]);
    return round5(trackingBaseEm + delta);
  }
  m = v.match(/^(-?[\d.]+)em$/);
  if (m) return round5(parseFloat(m[1]));
  return null;
}

const CSS_COLOR_TOKEN =
  /(rgba?\([^)]*\)|hsla?\([^)]*\)|oklch\([^)]*\)|#[0-9a-fA-F]{3,8})\s*$/;

/** Parse one box-shadow layer into a structured RN-friendly form (rem-aware). */
export function parseShadowLayer(layer, remBasePx = 16) {
  const norm = String(layer).replace(/\s+/g, " ").trim();
  let color = "#000000";
  let lengthsPart = norm;
  const cm = norm.match(CSS_COLOR_TOKEN);
  if (cm) {
    color = cssColorToHex(cm[1]);
    lengthsPart = norm.slice(0, cm.index).trim();
  }
  const lengths = lengthsPart
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => parseLengthToPx(t, remBasePx));
  const [offsetX = 0, offsetY = 0, blur = 0, spread = 0] = lengths;
  return { offsetX, offsetY, blur, spread, color };
}

/** Parse a multi-layer box-shadow value into ShadowLayer[]. */
export function parseShadow(value, remBasePx = 16) {
  return splitTopLevelCommas(value).map((l) => parseShadowLayer(l, remBasePx));
}

/**
 * The standard Tailwind v4 numeric spacing step set (w-4, gap-2, …) — still
 * used on web for sizes; native consumers get the same scale.
 */
export const SPACING_STEPS = [
  "0", "0.5", "1", "1.5", "2", "2.5", "3", "3.5", "4", "5", "6", "7", "8", "9",
  "10", "11", "12", "14", "16", "20", "24", "28", "32", "36", "40", "44", "48",
  "52", "56", "60", "64", "72", "80", "96",
];

/** Build the numeric spacing scale: { [step]: step * basePx }. */
export function buildSpacingScale(basePx = 4) {
  const out = {};
  for (const step of SPACING_STEPS) {
    out[step] = round2(parseFloat(step) * basePx);
  }
  return out;
}

function humanizeFontName(varName) {
  const stem = varName.replace(/^--font-/, "");
  if (["sans", "serif", "mono"].includes(stem)) return null;
  return stem
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Resolve a font-family value to a concrete family stack string. This repo's
 * @theme font slots are self-referential (--font-sans: var(--font-sans), the
 * concrete face coming from next/font at runtime), so config.fonts provides
 * the canonical stacks and wins over unresolvable var() chains.
 */
export function resolveFontStack(value, themeVars, configFonts = {}) {
  const out = [];
  for (const part of splitTopLevelCommas(value)) {
    const m = part.match(VAR_RE);
    if (m) {
      const ref = m[1];
      const slot = ref.replace(/^--font-/, "");
      if (configFonts[slot]) {
        out.push(configFonts[slot]);
      } else if (themeVars.has(ref) && themeVars.get(ref).trim() !== part) {
        out.push(themeVars.get(ref).trim());
      } else {
        const human = humanizeFontName(ref);
        if (human) out.push(human);
        if (m[2]) {
          for (const fb of splitTopLevelCommas(m[2])) out.push(fb.trim());
        }
      }
    } else {
      out.push(part.trim());
    }
  }
  const deduped = out.filter((v, i) => out.indexOf(v) === i && v.length > 0);
  return deduped.length ? deduped.join(", ") : "System";
}

// ---------------------------------------------------------------------------
// color-mix resolution (surfaces)
// ---------------------------------------------------------------------------

const COLOR_MIX_RE =
  /^color-mix\(\s*in\s+[\w-]+\s*,\s*([\s\S]+?)\s+([\d.]+)%\s*,\s*transparent\s*\)$/i;

/**
 * Resolve `color-mix(in oklab, <color> N%, transparent)` to hex8 for one mode.
 * Mixing toward transparent in a rectangular space with premultiplied alpha
 * (the CSS spec behavior) leaves the base channels unchanged and scales alpha,
 * so the result is exactly <color> at N% of its own alpha.
 * `resolveColor` maps a CSS color expression (var ref or literal) to hex.
 * Returns null for non-matching values (incl. mixes whose 2nd arg isn't
 * transparent — none exist in this repo's utilities).
 */
export function resolveColorMix(value, resolveColor) {
  const m = String(value).trim().match(COLOR_MIX_RE);
  if (!m) return null;
  const base = resolveColor(m[1].trim());
  if (base == null || !String(base).startsWith("#")) return null;
  return hexWithAlpha(base, parseFloat(m[2]) / 100);
}

/** "350ms" -> 350 ; "0.35s" -> 350. Returns null if unparseable. */
export function parseDurationToMs(value) {
  const v = String(value).trim();
  let m = v.match(/^(-?[\d.]+)ms$/);
  if (m) return parseFloat(m[1]);
  m = v.match(/^(-?[\d.]+)s$/);
  if (m) return round2(parseFloat(m[1]) * 1000);
  m = v.match(/^(-?[\d.]+)$/);
  if (m) return parseFloat(m[1]);
  return null;
}

/**
 * Parse a `cubic-bezier(...)` string into [x1,y1,x2,y2] or null.
 */
export function parseCubicBezier(value) {
  const m = String(value)
    .trim()
    .match(/^cubic-bezier\(\s*([^)]+)\s*\)$/i);
  if (!m) return null;
  const nums = m[1].split(",").map((n) => parseFloat(n.trim()));
  if (nums.length !== 4 || nums.some((n) => Number.isNaN(n))) return null;
  return nums;
}

// ---------------------------------------------------------------------------
// Core: build the in-memory token model
// ---------------------------------------------------------------------------

/**
 * @param {object} cssSources { globals, typography, surfaces } raw CSS strings
 * @param {object} config theme.config.json (already loaded)
 * @returns {{ tokens, rawShadows, counts, skippedSurfaces }}
 */
export function buildModel(cssSources, config) {
  const remBasePx = config.remBasePx ?? 16;
  const expectedThemeParams = String(config.themeInlineBlock || "@theme inline")
    .replace(/^@theme/, "")
    .trim();
  const configFonts = config.fonts || {};
  const surfacePrefixes = config.surfaceUtilityPrefixes || [];

  const root = parse(cssSources.globals);

  // --- locate @theme inline ---
  let themeNode = null;
  root.walkAtRules("theme", (at) => {
    if (at.params.trim() === expectedThemeParams) themeNode = at;
  });
  if (!themeNode) {
    throw new Error(
      `[@handicappin/tokens] Could not find "${config.themeInlineBlock}" block in ${config.source}. ` +
        `The design-system source structure changed — update theme.config.json.`,
    );
  }

  // --- locate the light (:root) and dark (.dark) theme blocks ---
  const lightSelector = String(config.lightSelector || ":root").trim();
  const darkSelector = String(config.darkSelector || ".dark").trim();
  let lightRule = null;
  let darkRule = null;
  root.walkRules((rule) => {
    const sel = rule.selector.trim();
    if (sel === lightSelector) lightRule = rule;
    if (sel === darkSelector) darkRule = rule;
  });
  if (!lightRule) {
    throw new Error(
      `[@handicappin/tokens] Could not find light theme block "${lightSelector}" in ${config.source}.`,
    );
  }
  if (!darkRule) {
    throw new Error(
      `[@handicappin/tokens] Could not find dark theme block "${darkSelector}" in ${config.source}.`,
    );
  }

  // Runtime vars per mode; dark falls back to light for vars it doesn't override.
  const lightVars = new Map();
  lightRule.walkDecls((d) => lightVars.set(d.prop, d.value.trim()));
  const darkVars = new Map(lightVars);
  darkRule.walkDecls((d) => darkVars.set(d.prop, d.value.trim()));
  const modeVars = { light: lightVars, dark: darkVars };

  const radiusBaseRaw = lightVars.get("--radius");
  if (radiusBaseRaw == null) {
    throw new Error(
      `[@handicappin/tokens] No --radius found in ${lightSelector}; cannot resolve calc(var(--radius) ± N).`,
    );
  }
  const radiusBaseRem = parseRem(radiusBaseRaw);
  const trackingBaseRaw = lightVars.get("--tracking-normal");
  const trackingBaseEm = trackingBaseRaw != null ? parseRem(trackingBaseRaw) : 0;

  const colors = { light: {}, dark: {} };
  const radii = {};
  const radiiRem = {};
  const spacing = {};
  const spacingRem = {};
  const sizes = {};
  const breakpoints = {};
  const tracking = {};
  const shadows = {};
  const rawShadows = {};
  const easing = {};
  const durations = {};
  const fontsRaw = {};
  let themeColorCount = 0;

  themeNode.walkDecls((decl) => {
    const prop = decl.prop;
    const value = decl.value;
    if (prop.includes("*")) return; // namespace resets like --breakpoint-*: initial

    if (prop.startsWith("--color-")) {
      themeColorCount++;
      const name = prop.replace("--color-", "");
      for (const mode of ["light", "dark"]) {
        const resolved = resolveColorValue(value, modeVars[mode]);
        if (resolved != null) colors[mode][name] = resolved;
      }
      return;
    }

    if (prop.startsWith("--font-")) {
      fontsRaw[prop] = resolveFontStack(value, lightVars, configFonts);
      return;
    }

    if (prop.startsWith("--radius-")) {
      const r = resolveRadiusValue(value, radiusBaseRem, remBasePx);
      if (r) {
        const key = prop.replace("--radius-", "");
        radii[key] = r.px;
        radiiRem[key] = r.rem;
      }
      return;
    }

    if (prop.startsWith("--spacing-")) {
      const r = parseRemPx(value, remBasePx);
      if (!Number.isNaN(r.px)) {
        const key = prop.replace("--spacing-", "");
        spacing[key] = r.px;
        spacingRem[key] = r.rem;
      }
      return;
    }

    if (prop.startsWith("--size-")) {
      const r = parseRemPx(value, remBasePx);
      if (!Number.isNaN(r.px)) sizes[prop.replace("--size-", "")] = r.px;
      return;
    }

    if (prop.startsWith("--breakpoint-")) {
      const r = parseRemPx(value, remBasePx);
      if (!Number.isNaN(r.px)) breakpoints[prop.replace("--breakpoint-", "")] = r.px;
      return;
    }

    if (prop.startsWith("--tracking-")) {
      const em = resolveTrackingValue(value, trackingBaseEm);
      if (em != null) tracking[prop.replace("--tracking-", "")] = em;
      return;
    }

    if (prop === "--shadow" || prop.startsWith("--shadow-")) {
      // bare --shadow is the default tier — keyed DEFAULT like Tailwind does.
      const key = prop === "--shadow" ? "DEFAULT" : prop.replace("--shadow-", "");
      // @theme shadow slots are self-referential (var(--shadow-sm)) — resolve
      // through :root. Dark mode doesn't redefine shadows in this repo.
      let raw = value.trim();
      const vm = raw.match(VAR_RE);
      if (vm && lightVars.has(vm[1])) raw = lightVars.get(vm[1]).trim();
      else if (vm) return; // unresolvable self-reference
      shadows[key] = parseShadow(raw, remBasePx);
      rawShadows[key] = raw.replace(/\s+/g, " ").trim();
      return;
    }

    if (prop.startsWith("--ease-")) {
      const css = value.replace(/\s+/g, " ").trim();
      easing[prop.replace("--ease-", "")] = {
        css,
        ...(parseCubicBezier(css) ? { bezier: parseCubicBezier(css) } : {}),
      };
      return;
    }

    if (prop.startsWith("--duration-")) {
      const ms = parseDurationToMs(value);
      if (ms != null) durations[prop.replace("--duration-", "")] = ms;
      return;
    }
  });

  // Numeric Tailwind scale from the :root --spacing base (0.25rem default).
  const spacingBaseRaw = lightVars.get("--spacing");
  const spacingBasePx =
    spacingBaseRaw != null
      ? round2(parseRem(spacingBaseRaw) * remBasePx)
      : round2(0.25 * remBasePx);
  const spacingScale = buildSpacingScale(spacingBasePx);

  // --- typography: @utility text-* blocks ---
  const typography = {};
  const typoRoot = parse(cssSources.typography);
  typoRoot.walkAtRules("utility", (at) => {
    const name = at.params.trim();
    if (!/^text-[\w-]+$/.test(name)) return;
    const spec = {};
    at.walkDecls((d) => {
      switch (d.prop) {
        case "font-family":
          spec.fontFamily = resolveFontStack(d.value, lightVars, configFonts);
          break;
        case "font-weight":
          spec.fontWeight = parseInt(d.value, 10);
          break;
        case "font-style":
          spec.fontStyle = d.value.trim();
          break;
        case "font-size": {
          const r = parseRemPx(d.value, remBasePx);
          spec.fontSize = r.px;
          spec.fontSizeRem = r.rem;
          break;
        }
        case "line-height": {
          // unitless line-height (e.g. `line-height: 1`) is a multiplier
          const v = d.value.trim();
          if (/^[\d.]+$/.test(v)) {
            spec.lineHeightMultiplier = parseFloat(v);
          } else {
            const r = parseRemPx(d.value, remBasePx);
            spec.lineHeight = r.px;
            spec.lineHeightRem = r.rem;
          }
          break;
        }
        case "letter-spacing": {
          const v = d.value.trim();
          const em = v.match(/^(-?[\d.]+)em$/);
          if (em) {
            spec.letterSpacingEm = parseFloat(em[1]);
          } else {
            spec.letterSpacing = parseLengthToPx(v, remBasePx);
          }
          break;
        }
        case "text-transform":
          spec.textTransform = d.value.trim();
          break;
      }
    });
    // Resolve dependent values once the whole block is read.
    if (spec.lineHeightMultiplier != null && spec.fontSize != null) {
      spec.lineHeight = round2(spec.fontSize * spec.lineHeightMultiplier);
      spec.lineHeightRem = round5(spec.lineHeight / remBasePx);
      delete spec.lineHeightMultiplier;
    }
    if (spec.letterSpacingEm != null && spec.fontSize != null) {
      // RN letterSpacing is px-like (dp); convert em against this entry's size.
      spec.letterSpacing = round2(spec.letterSpacingEm * spec.fontSize);
    }
    typography[name] = spec;
  });

  // --- surfaces: @utility recipes (color-mix → per-mode hex8) ---
  const surfaces = { light: {}, dark: {} };
  const skippedSurfaces = [];
  const surfRoot = parse(cssSources.surfaces);

  // Resolve a color expression appearing inside surfaces.css for one mode:
  // var(--color-X) → the resolved theme color; literals convert directly.
  const colorExprResolver = (mode) => (expr) => {
    const m = String(expr).trim().match(VAR_RE);
    if (m) {
      const name = m[1].replace(/^--color-/, "");
      return colors[mode][name] ?? null;
    }
    return cssColorToHex(expr);
  };

  surfRoot.walkAtRules("utility", (at) => {
    const name = at.params.trim();
    if (!surfacePrefixes.some((p) => name === p || name.startsWith(p))) {
      skippedSurfaces.push(name);
      return;
    }
    let unsupported = null;
    const perMode = { light: {}, dark: {} };

    const lengthPx = (v) => {
      const m = String(v).trim().match(VAR_RE);
      if (m) {
        const ref = m[1];
        if (ref.startsWith("--spacing-")) return spacing[ref.replace("--spacing-", "")] ?? null;
        if (ref.startsWith("--radius-")) return radii[ref.replace("--radius-", "")] ?? null;
        if (ref.startsWith("--size-")) return sizes[ref.replace("--size-", "")] ?? null;
        return null;
      }
      const px = parseLengthToPx(v, remBasePx);
      return Number.isNaN(px) ? null : px;
    };

    at.walkDecls((d) => {
      if (unsupported) return;
      const prop = d.prop;
      const value = d.value.trim();
      for (const mode of ["light", "dark"]) {
        const resolveColor = colorExprResolver(mode);
        const out = perMode[mode];
        switch (prop) {
          case "background-color": {
            const c = resolveColorMix(value, resolveColor) ?? resolveColor(value);
            if (c == null) unsupported = `${prop}: ${value}`;
            else out.backgroundColor = c;
            break;
          }
          case "color": {
            const c = resolveColorMix(value, resolveColor) ?? resolveColor(value);
            if (c == null) unsupported = `${prop}: ${value}`;
            else out.color = c;
            break;
          }
          case "border": {
            // "<width> solid <color-expr>" — color-mix or var
            const m = value.match(/^([\d.]+)px\s+solid\s+([\s\S]+)$/);
            if (!m) {
              unsupported = `${prop}: ${value}`;
              break;
            }
            const c = resolveColorMix(m[2], resolveColor) ?? resolveColor(m[2]);
            if (c == null) unsupported = `${prop}: ${value}`;
            else {
              out.borderWidth = parseFloat(m[1]);
              out.borderColor = c;
            }
            break;
          }
          case "border-radius": {
            const px = lengthPx(value);
            if (px == null) unsupported = `${prop}: ${value}`;
            else out.borderRadius = px;
            break;
          }
          case "padding": {
            const parts = value.split(/\s+/);
            const px = parts.map(lengthPx);
            if (px.some((p) => p == null) || px.length > 2) {
              // 3-/4-value shorthand has no slot in the contract — surface it
              // as unsupported rather than silently dropping values.
              unsupported = `${prop}: ${value}`;
            } else if (px.length === 1) {
              out.padding = px[0];
            } else {
              out.paddingVertical = px[0];
              out.paddingHorizontal = px[1];
            }
            break;
          }
          case "width":
          case "height": {
            const px = lengthPx(value);
            if (px == null) unsupported = `${prop}: ${value}`;
            else out[prop] = px;
            break;
          }
          case "font-size": {
            const px = lengthPx(value);
            if (px == null) unsupported = `${prop}: ${value}`;
            else out.fontSize = px;
            break;
          }
          case "line-height": {
            const px = lengthPx(value);
            if (px == null) unsupported = `${prop}: ${value}`;
            else out.lineHeight = px;
            break;
          }
          case "font-family":
            out.fontFamily = resolveFontStack(value, lightVars, configFonts);
            break;
          case "box-shadow": {
            const m = value.match(VAR_RE);
            const key = m ? m[1].replace("--shadow-", "") : null;
            if (key && shadows[key]) out.shadow = key;
            else unsupported = `${prop}: ${value}`;
            break;
          }
          case "align-items":
            out.alignItems = value;
            break;
          case "justify-content":
            out.justifyContent = value;
            break;
          case "flex-shrink":
            out.flexShrink = parseFloat(value);
            break;
          case "display":
            // RN views are flex by default; inline-flex has no RN analogue.
            break;
          default:
            unsupported = `${prop}: ${value}`;
        }
      }
    });

    if (unsupported) {
      skippedSurfaces.push(`${name} (unsupported ${unsupported})`);
      return;
    }
    surfaces.light[name] = perMode.light;
    surfaces.dark[name] = perMode.dark;
  });

  const fonts = {
    sans: fontsRaw["--font-sans"] ?? configFonts.sans ?? "System",
    mono: fontsRaw["--font-mono"] ?? configFonts.mono ?? "System",
    serif: fontsRaw["--font-serif"] ?? configFonts.serif ?? "System",
  };

  const tokens = {
    colors,
    radii,
    radiiRem,
    spacing,
    spacingRem,
    spacingScale,
    sizes,
    breakpoints,
    tracking,
    shadows,
    typography,
    surfaces,
    easing,
    durations,
    fonts,
  };

  const counts = {
    themeColors: themeColorCount,
    colorsLight: Object.keys(colors.light).length,
    colorsDark: Object.keys(colors.dark).length,
    radii: Object.keys(radii).length,
    spacing: Object.keys(spacing).length,
    sizes: Object.keys(sizes).length,
    breakpoints: Object.keys(breakpoints).length,
    tracking: Object.keys(tracking).length,
    shadows: Object.keys(shadows).length,
    typography: Object.keys(typography).length,
    surfaces: Object.keys(surfaces.light).length,
    skippedSurfaces: skippedSurfaces.length,
  };

  return { tokens, rawShadows, counts, skippedSurfaces };
}

// ---------------------------------------------------------------------------
// Serializers (deterministic — insertion order from the AST walk)
// ---------------------------------------------------------------------------

const HEADER = (source) =>
  [
    "/**",
    " * AUTO-GENERATED by @handicappin/tokens (src/generate.mjs) — DO NOT EDIT.",
    ` * Source: ${source}`,
    " * Regenerate with: pnpm generate:theme",
    " */",
    "",
  ].join("\n");

export function serializeTokensTs(tokens, source) {
  const lines = [];
  lines.push(HEADER(source));
  lines.push("export interface ShadowLayer {");
  lines.push("  offsetX: number;");
  lines.push("  offsetY: number;");
  lines.push("  blur: number;");
  lines.push("  spread: number;");
  lines.push("  /** hex (#rrggbb or #rrggbbaa) — RN-consumable. */");
  lines.push("  color: string;");
  lines.push("}");
  lines.push("");
  lines.push("export interface TypeSpec {");
  lines.push("  fontFamily?: string;");
  lines.push("  fontWeight?: number;");
  lines.push("  fontStyle?: string;");
  lines.push("  /** px at the nominal 16px rem base. */");
  lines.push("  fontSize?: number;");
  lines.push("  fontSizeRem?: number;");
  lines.push("  lineHeight?: number;");
  lines.push("  lineHeightRem?: number;");
  lines.push("  /** px (dp) — em sources are pre-multiplied by this entry's font size. */");
  lines.push("  letterSpacing?: number;");
  lines.push("  /** original em value when the source used em. */");
  lines.push("  letterSpacingEm?: number;");
  lines.push("  textTransform?: string;");
  lines.push("}");
  lines.push("");
  lines.push("export interface SurfaceStyle {");
  lines.push("  backgroundColor?: string;");
  lines.push("  color?: string;");
  lines.push("  borderWidth?: number;");
  lines.push("  borderColor?: string;");
  lines.push("  borderRadius?: number;");
  lines.push("  padding?: number;");
  lines.push("  paddingVertical?: number;");
  lines.push("  paddingHorizontal?: number;");
  lines.push("  width?: number;");
  lines.push("  height?: number;");
  lines.push("  fontSize?: number;");
  lines.push("  lineHeight?: number;");
  lines.push("  fontFamily?: string;");
  lines.push("  /** key into tokens.shadows. */");
  lines.push("  shadow?: string;");
  lines.push("  alignItems?: string;");
  lines.push("  justifyContent?: string;");
  lines.push("  flexShrink?: number;");
  lines.push("}");
  lines.push("");
  lines.push("export interface Easing {");
  lines.push("  css: string;");
  lines.push("  bezier?: [number, number, number, number];");
  lines.push("}");
  lines.push("");
  lines.push("export type ModeRecord<T> = { light: T; dark: T };");
  lines.push("");
  lines.push("export interface Tokens {");
  lines.push("  /** resolved hex per mode (key = web utility name, e.g. 'primary'). */");
  lines.push("  colors: ModeRecord<Record<string, string>>;");
  lines.push("  /** px at the nominal 16px rem base. */");
  lines.push("  radii: Record<string, number>;");
  lines.push("  radiiRem: Record<string, number>;");
  lines.push("  /** semantic spacing ramp (xs..5xl) -> px. */");
  lines.push("  spacing: Record<string, number>;");
  lines.push("  spacingRem: Record<string, number>;");
  lines.push("  /** Tailwind numeric scale: step (string, e.g. '4', '0.5') -> px. */");
  lines.push("  spacingScale: Record<string, number>;");
  lines.push("  /** component-size tokens (--size-*) -> px. */");
  lines.push("  sizes: Record<string, number>;");
  lines.push("  /** breakpoint tokens -> px. */");
  lines.push("  breakpoints: Record<string, number>;");
  lines.push("  /** letter-spacing scale -> em. */");
  lines.push("  tracking: Record<string, number>;");
  lines.push("  shadows: Record<string, ShadowLayer[]>;");
  lines.push("  typography: Record<string, TypeSpec>;");
  lines.push("  /** surface/tint/chip utility recipes, resolved per mode. */");
  lines.push("  surfaces: ModeRecord<Record<string, SurfaceStyle>>;");
  lines.push("  easing: Record<string, Easing>;");
  lines.push("  durations: Record<string, number>;");
  lines.push("  fonts: { sans: string; mono: string; serif: string };");
  lines.push("}");
  lines.push("");
  lines.push(`export const tokens: Tokens = ${JSON.stringify(tokens, null, 2)};`);
  lines.push("");
  return lines.join("\n");
}

/**
 * Native-app NativeWind v5 / Tailwind v4 entry (Phase-1 preview; becomes
 * apps/native/global.css when the native app exists).
 *
 * Mirrors the web globals.css structure with native-safe values:
 *   - @theme inline + :root/.dark var indirection (hex, not oklch — RN's
 *     lightningcss pipeline doesn't parse oklch)
 *   - typography as @utility text-* with px units + bundled Inter face names
 *   - surface/tint/chip recipes as @utility backed by per-mode CSS vars
 *     (color-mix resolved at generation time — RN has no color-mix)
 */
/** Rebuild a CSS shadow string from structured layers (hex colors — native-safe). */
export function shadowToCss(layers) {
  return layers
    .map((l) => `${l.offsetX}px ${l.offsetY}px ${l.blur}px ${l.spread}px ${l.color}`)
    .join(", ");
}

export function serializeNativeGlobalCss(model, source) {
  const { tokens } = model;
  const lines = [];
  lines.push("/*");
  lines.push(" * NativeWind v5 / Tailwind v4 entry for the future native app.");
  lines.push(" *");
  lines.push(" * FULLY GENERATED by @handicappin/tokens (src/generate.mjs) from the web");
  lines.push(` * design system (${source} + utility layers) — a web token change`);
  lines.push(" * regenerates this file. Do NOT hand-edit; run pnpm generate:theme.");
  lines.push(" *");
  lines.push(" * Phase-1 note: no native app consumes this yet. It is emitted to prove");
  lines.push(" * the pipeline and lock the contract; when apps/native lands, point");
  lines.push(" * theme.config.json outputs.nativeCss at apps/native/global.css and");
  lines.push(" * validate against a real NativeWind build (dark-mode strategy included).");
  lines.push(" */");
  lines.push("");
  lines.push("@import 'tailwindcss';");
  lines.push("@import 'nativewind/theme';");
  lines.push("");
  lines.push('@custom-variant dark (&:is(.dark *));');
  lines.push("");

  // @theme inline: token slots referencing runtime vars (mode-switchable).
  lines.push("@theme inline {");
  for (const name of Object.keys(tokens.colors.light)) {
    lines.push(`  --color-${name}: var(--${name});`);
  }
  lines.push("");
  for (const [name, px] of Object.entries(tokens.radii)) {
    lines.push(`  --radius-${name}: ${px}px;`);
  }
  lines.push("");
  for (const [name, px] of Object.entries(tokens.spacing)) {
    lines.push(`  --spacing-${name}: ${px}px;`);
  }
  lines.push("");
  for (const [name, px] of Object.entries(tokens.sizes)) {
    lines.push(`  --size-${name}: ${px}px;`);
  }
  lines.push("");
  lines.push("  /* shadows (hex-rebuilt — oklch is not native-parseable; */");
  lines.push("  /*  RN consumers should prefer the structured tokens.shadows) */");
  for (const [name, layers] of Object.entries(tokens.shadows)) {
    const slot = name === "DEFAULT" ? "--shadow" : `--shadow-${name}`;
    lines.push(`  ${slot}: ${shadowToCss(layers)};`);
  }
  lines.push("}");
  lines.push("");

  // Per-mode runtime vars: theme colors + surface recipe colors.
  const surfaceVarLines = (mode) => {
    const out = [];
    for (const [sName, style] of Object.entries(tokens.surfaces[mode])) {
      if (style.backgroundColor != null)
        out.push(`  --sf-${sName}-bg: ${style.backgroundColor};`);
      if (style.borderColor != null)
        out.push(`  --sf-${sName}-border: ${style.borderColor};`);
      if (style.color != null) out.push(`  --sf-${sName}-fg: ${style.color};`);
    }
    return out;
  };
  for (const mode of ["light", "dark"]) {
    lines.push(mode === "light" ? ":root {" : ".dark {");
    for (const [name, hex] of Object.entries(tokens.colors[mode])) {
      lines.push(`  --${name}: ${hex};`);
    }
    lines.push("");
    lines.push("  /* resolved surface recipe colors (color-mix flattened) */");
    lines.push(...surfaceVarLines(mode));
    lines.push("}");
    lines.push("");
  }

  // Native typography ramp.
  lines.push("/* Native typography ramp — px units + bundled Inter faces. */");
  for (const [name, spec] of Object.entries(tokens.typography)) {
    const face = nativeFaceFor(spec);
    lines.push(`@utility ${name} {`);
    if (face.fontFamily) lines.push(`  font-family: ${face.fontFamily};`);
    if (face.fontWeight != null) lines.push(`  font-weight: ${face.fontWeight};`);
    if (spec.fontStyle != null) lines.push(`  font-style: ${spec.fontStyle};`);
    if (spec.fontSize != null) lines.push(`  font-size: ${spec.fontSize}px;`);
    if (spec.lineHeight != null) lines.push(`  line-height: ${spec.lineHeight}px;`);
    if (spec.letterSpacing != null)
      lines.push(`  letter-spacing: ${spec.letterSpacing}px;`);
    if (spec.textTransform != null)
      lines.push(`  text-transform: ${spec.textTransform};`);
    lines.push("}");
  }
  lines.push("");

  // Surface utilities — same class names as web, color-mix flattened to vars.
  lines.push("/* Surface/tint/chip recipes — same class names as web. */");
  for (const [name, style] of Object.entries(tokens.surfaces.light)) {
    lines.push(`@utility ${name} {`);
    if (style.backgroundColor != null)
      lines.push(`  background-color: var(--sf-${name}-bg);`);
    if (style.color != null) lines.push(`  color: var(--sf-${name}-fg);`);
    if (style.borderWidth != null)
      lines.push(`  border: ${style.borderWidth}px solid var(--sf-${name}-border);`);
    if (style.borderRadius != null)
      lines.push(`  border-radius: ${style.borderRadius}px;`);
    if (style.padding != null) lines.push(`  padding: ${style.padding}px;`);
    if (style.paddingVertical != null && style.paddingHorizontal != null)
      lines.push(`  padding: ${style.paddingVertical}px ${style.paddingHorizontal}px;`);
    if (style.width != null) lines.push(`  width: ${style.width}px;`);
    if (style.height != null) lines.push(`  height: ${style.height}px;`);
    if (style.fontSize != null) lines.push(`  font-size: ${style.fontSize}px;`);
    if (style.lineHeight != null) lines.push(`  line-height: ${style.lineHeight}px;`);
    if (style.fontFamily != null) lines.push(`  font-family: ${style.fontFamily};`);
    if (style.alignItems != null) lines.push(`  align-items: ${style.alignItems};`);
    if (style.justifyContent != null)
      lines.push(`  justify-content: ${style.justifyContent};`);
    if (style.flexShrink != null) lines.push(`  flex-shrink: ${style.flexShrink};`);
    lines.push("}");
  }
  lines.push("");
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

export function loadConfig(configPath = resolve(packageRoot, "theme.config.json")) {
  const config = JSON.parse(readFileSync(configPath, "utf-8"));
  for (const key of ["source", "typographySource", "surfacesSource"]) {
    if (!config[key])
      throw new Error(`[@handicappin/tokens] theme.config.json missing "${key}".`);
  }
  return config;
}

export function main() {
  const config = loadConfig();
  const cssSources = {
    globals: readFileSync(resolve(packageRoot, config.source), "utf-8"),
    typography: readFileSync(resolve(packageRoot, config.typographySource), "utf-8"),
    surfaces: readFileSync(resolve(packageRoot, config.surfacesSource), "utf-8"),
  };

  const model = buildModel(cssSources, config);
  const { tokens, counts, skippedSurfaces } = model;

  const outDir = resolve(packageRoot, config.outputDir || "./generated");
  mkdirSync(outDir, { recursive: true });

  writeFileSync(
    resolve(packageRoot, config.outputs.tokens),
    serializeTokensTs(tokens, config.source),
  );
  writeFileSync(
    resolve(packageRoot, config.outputs.nativeCss),
    serializeNativeGlobalCss(model, config.source),
  );

  console.log("[@handicappin/tokens] generated:");
  console.log(`  ${config.outputs.tokens}`);
  console.log(`  ${config.outputs.nativeCss}`);
  console.log("[@handicappin/tokens] counts:", JSON.stringify(counts));
  if (skippedSurfaces.length) {
    console.log(
      "[@handicappin/tokens] skipped surface utilities (not in contract):",
      skippedSurfaces.join(", "),
    );
  }
  return model;
}

// Run when invoked directly (not when imported by tests).
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
