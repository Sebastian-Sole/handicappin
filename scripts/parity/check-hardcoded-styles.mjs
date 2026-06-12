#!/usr/bin/env node
/**
 * check-hardcoded-styles — lint guardrail that fails when NATIVE app styling
 * is hardcoded instead of using the generated design tokens
 * (@handicappin/tokens). The native twin of the web-side `pnpm check:tokens`.
 * Ported from the ks-digital reference implementation.
 *
 * Scans apps/native/{components,app,lib} (TS/TSX) line by line and flags hex
 * colors, rgb()/rgba() literals, numeric spacing/radius literals, inline font
 * properties (use the generated `text-*` classNames), and boxShadow string
 * literals.
 *
 * DORMANT until apps/native exists (prints a note, exits 0).
 *
 * ESCAPE HATCH: append `// allow-hardcoded <reason>` (or `// off-scale` for a
 * spacing value with no token step) to the SAME line. Do not mass-suppress.
 *
 * No dependencies — plain Node ESM + the standard library.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = join(__dirname, "..", "..", "apps", "native");

/** Directories to scan, relative to the native app root. */
const SCAN_DIRS = ["components", "app", "lib"];

/** Spacing style properties whose value must come from `tokens.spacing[...]`. */
const SPACING_PROPS = [
  "padding", "paddingHorizontal", "paddingVertical", "paddingTop",
  "paddingBottom", "paddingStart", "paddingEnd", "paddingLeft", "paddingRight",
  "margin", "marginHorizontal", "marginVertical", "marginTop", "marginBottom",
  "marginStart", "marginEnd", "marginLeft", "marginRight",
  "gap", "columnGap", "rowGap",
];

const RULES = [
  {
    id: "hex-color",
    label: "Hardcoded hex color (use tokens.colors / withAlpha)",
    test: (line) => /#[0-9a-fA-F]{3,8}\b/.test(line),
  },
  {
    id: "rgb-literal",
    label: "rgb()/rgba() literal (use tokens.colors / withAlpha)",
    test: (line) => /\brgba?\(/.test(line),
  },
  {
    id: "spacing-literal",
    label: "Numeric spacing literal (use tokens.spacing[...])",
    test: (line) => {
      const re = new RegExp(`\\b(?:${SPACING_PROPS.join("|")}):(\\s*)-?[0-9]`);
      const m = re.exec(line);
      if (!m) return false;
      return !isZeroValue(line, m.index + m[0].length - 1);
    },
  },
  {
    id: "radius-literal",
    label: "Numeric borderRadius literal (use tokens.radii.*)",
    test: (line) => {
      const m = /\bborderRadius:\s*-?[0-9]/.exec(line);
      if (!m) return false;
      return !isZeroValue(line, m.index + m[0].length - 1);
    },
  },
  {
    id: "font-fontSize",
    label: "Inline fontSize (use a generated text-* className)",
    test: (line) => /\bfontSize:\s*[0-9]/.test(line),
  },
  {
    id: "font-lineHeight",
    label: "Inline lineHeight (use a generated text-* className)",
    test: (line) => /\blineHeight:\s*[0-9]/.test(line),
  },
  {
    id: "font-letterSpacing",
    label: "Inline letterSpacing (use a generated text-* className)",
    test: (line) => /\bletterSpacing:\s*-?[0-9]/.test(line),
  },
  {
    id: "font-fontWeight",
    label: "Inline fontWeight (use a generated text-* className)",
    test: (line) => /\bfontWeight:\s*['"0-9]/.test(line),
  },
  {
    id: "font-fontFamily",
    label: "Inline fontFamily literal (use a generated text-* className / FONT_FACES)",
    test: (line) => /\bfontFamily:\s*['"]/.test(line),
  },
  {
    id: "boxShadow-literal",
    label: "boxShadow string literal (use tokens.shadows)",
    test: (line) => /\bboxShadow:\s*['"]/.test(line),
  },
];

/** Files exempt entirely (token-consuming helpers, generated output, tests). */
function isExemptFile(relPath) {
  const p = relPath.replace(/\\/g, "/");
  if (p === "lib/ui/color.ts") return true; // withAlpha hex math
  if (p === "lib/ui/shadow.ts") return true; // shadow helper over tokens.shadows
  if (p === "app/+html.tsx") return true; // web-export document
  if (p === "global.css") return true;
  if (p.includes("/generated/")) return true;
  if (p.includes("/__tests__/")) return true;
  if (/\.test\.tsx?$/.test(p)) return true;
  return false;
}

/** A spacing/radius value is `0` when the matched digit is a bare 0. */
function isZeroValue(line, colonRegionStart) {
  const ch = line[colonRegionStart];
  if (ch !== "0") return false;
  const next = line[colonRegionStart + 1];
  return next === undefined || !/[0-9.]/.test(next);
}

/** Allowlist comment on the same line (escape hatch + off-scale spacing).
    Both markers must appear inside a `//` comment — a bare "off-scale"
    substring in a string or identifier must not mute the checks. */
function hasAllowComment(line) {
  return /\/\/.*(?:allow-hardcoded|off-scale)/.test(line);
}

/** Pure comment lines are never flagged. */
function isCommentLine(line) {
  const t = line.trim();
  return (
    t === "" || t.startsWith("//") || t.startsWith("*") || t.startsWith("/*") || t.startsWith("*/")
  );
}

/** Strip a trailing `//` comment (string-aware, crude but sufficient). */
function stripTrailingComment(line) {
  let inS = null;
  for (let i = 0; i < line.length - 1; i++) {
    const ch = line[i];
    if (inS) {
      if (ch === inS) inS = null;
      else if (ch === "\\") i++;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === "`") {
      inS = ch;
      continue;
    }
    if (ch === "/" && line[i + 1] === "/") return line.slice(0, i);
  }
  return line;
}

function collectFiles(dir, acc) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return acc;
  }
  for (const name of entries) {
    const full = join(dir, name);
    const st = statSync(full, { throwIfNoEntry: false });
    if (!st) continue; // deleted mid-scan or broken symlink
    if (st.isDirectory()) {
      if (name === "node_modules") continue;
      collectFiles(full, acc);
    } else if (/\.tsx?$/.test(name) && !name.endsWith(".d.ts")) {
      acc.push(full);
    }
  }
  return acc;
}

function main() {
  if (!existsSync(APP_ROOT)) {
    console.log(
      "check-hardcoded-styles: DORMANT (apps/native not present) — activates when the native app lands.",
    );
    process.exit(0);
  }

  const files = [];
  for (const d of SCAN_DIRS) collectFiles(join(APP_ROOT, d), files);

  const violations = [];

  for (const file of files) {
    const rel = relative(APP_ROOT, file);
    if (isExemptFile(rel)) continue;

    const src = readFileSync(file, "utf8");
    const lines = src.split("\n");
    let inBlockComment = false;

    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i];
      const trimmed = raw.trim();
      if (inBlockComment) {
        if (trimmed.includes("*/")) inBlockComment = false;
        continue;
      }
      if (trimmed.startsWith("/*") && !trimmed.includes("*/")) {
        inBlockComment = true;
        continue;
      }
      if (isCommentLine(raw)) continue;
      if (hasAllowComment(raw)) continue;

      const code = stripTrailingComment(raw);
      if (code.trim() === "") continue;

      for (const rule of RULES) {
        if (rule.test(code)) {
          violations.push({
            file: rel,
            line: i + 1,
            rule: rule.id,
            snippet: trimmed.slice(0, 120),
          });
        }
      }
    }
  }

  if (violations.length === 0) {
    console.log("check-hardcoded-styles: PASS — no hardcoded styling found.");
    process.exit(0);
  }

  console.log("check-hardcoded-styles: FAIL\n");
  for (const v of violations) {
    console.log(`${v.file}:${v.line}: ${v.rule} — ${v.snippet}`);
  }

  const byRule = {};
  for (const v of violations) byRule[v.rule] = (byRule[v.rule] || 0) + 1;
  console.log("\nSummary by rule:");
  for (const [rule, count] of Object.entries(byRule).sort()) {
    console.log(`  ${rule}: ${count}`);
  }
  console.log(`\nTotal: ${violations.length} violation(s).`);
  console.log(
    "Convert to generated tokens, or tag a genuine exception with `// allow-hardcoded <reason>`.",
  );
  process.exit(1);
}

main();
