import nextConfig from "eslint-config-next";

/**
 * Design-system guardrails. These rules enforce that visual styling goes
 * through the semantic tokens declared in `lib/design/tokens.ts` /
 * `app/globals.css` rather than raw Tailwind color utilities, and that
 * heading tags live in the typography primitives in `components/ui/`.
 *
 * Migration is complete — the rule applies unconditionally outside
 * `components/ui/**` (where the primitives themselves live) and a small
 * set of framework-specific exceptions (emails, Supabase edge functions,
 * this config). To change brand colors across the app, update the tokens
 * in `app/globals.css`; every usage will pick up the new values.
 */

// Raw color utility pattern. Matches `bg-red-500`, `text-gray-50`,
// `border-amber-200`, `hover:bg-blue-700`, etc. Word boundaries on both
// sides so `bg-success` / `text-primary` pass cleanly.
const COLOR_RE_SRC =
  "(?:^|[\\s:])(?:bg|text|border|ring|fill|stroke|divide|outline|placeholder|from|to|via|caret|accent|decoration|shadow)-(?:red|green|amber|blue|yellow|orange|pink|purple|gray|zinc|slate|neutral|stone|indigo|violet|fuchsia|rose|sky|cyan|teal|emerald|lime)-\\d+";

const colorTokenMessage =
  "Avoid raw Tailwind color utilities. Use semantic tokens from `lib/design/tokens.ts` / `app/globals.css` (bg-destructive, text-success, bg-warning, text-info, score-eagle/birdie/par/bogey/double/triple, etc.).";

const colorSelectors = [
  {
    selector: `Literal[value=/${COLOR_RE_SRC}/]`,
    message: colorTokenMessage,
  },
  {
    selector: `TemplateElement[value.raw=/${COLOR_RE_SRC}/]`,
    message: colorTokenMessage,
  },
];

const headingSelectors = ["h1", "h2", "h3", "h4", "h5", "h6"].map((tag) => ({
  selector: `JSXOpeningElement[name.name='${tag}']`,
  message: `Use the typography primitives from \`components/ui/typography.tsx\` (<${tag.toUpperCase()}>) instead of raw <${tag}>. This is enforced outside \`components/ui/**\`.`,
}));

const BASELINE_IGNORES = [
  "components/ui/**",
  "emails/**",
  "supabase/functions/**",
  "eslint.config.mjs",
];

const eslintConfig = [
  {
    // Global ignores. `.claude/**` is tooling/harness code with a
    // pre-existing parsing error in `scripts/run-review.js`; out of
    // scope for the design-system refactor.
    ignores: [".claude/**", ".next/**", "node_modules/**"],
  },
  ...nextConfig,
  {
    // React Email templates need raw apostrophes for email client compatibility
    files: ["emails/**/*.tsx", "supabase/functions/**/*.tsx"],
    rules: {
      "react/no-unescaped-entities": "off",
    },
  },
  {
    // Design-system guardrail: both color + heading rules apply to every
    // source file outside the baseline-ignored primitives / email templates.
    files: ["**/*.{ts,tsx,js,jsx,mjs,cjs}"],
    ignores: BASELINE_IGNORES,
    rules: {
      "no-restricted-syntax": [
        "error",
        ...colorSelectors,
        ...headingSelectors,
      ],
    },
  },
];

export default eslintConfig;
