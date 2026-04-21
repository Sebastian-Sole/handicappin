import nextConfig from "eslint-config-next";

/**
 * Design-system guardrails. These rules enforce that visual styling goes
 * through the semantic tokens declared in `lib/design/tokens.ts` /
 * `app/globals.css` rather than raw Tailwind color utilities, and that
 * heading tags live in the typography primitives in `components/ui/`.
 *
 * Implementation note: ESLint flat config replaces (rather than merges)
 * rule options when multiple config blocks define the same rule for the
 * same file. `no-restricted-syntax` is the only ESLint built-in that
 * fits both our checks, so we pack both selector sets into a single
 * rule invocation and scope with `files` / `ignores`.
 */

// Raw color utility pattern. Matches `bg-red-500`, `text-gray-50`,
// `border-amber-200`, `hover:bg-blue-700`, etc. Word boundaries on both
// sides so `bg-success` / `text-primary` pass cleanly.
const COLOR_RE_SRC =
  "(?:^|[\\s:])(?:bg|text|border|ring|fill|stroke|divide|outline|placeholder|from|to|via|caret|accent|decoration|shadow)-(?:red|green|amber|blue|yellow|orange|pink|purple|gray|zinc|slate|neutral|stone|indigo|violet|fuchsia|rose|sky|cyan|teal|emerald|lime)-\\d+";

const colorTokenMessage =
  "Avoid raw Tailwind color utilities. Use semantic tokens from `lib/design/tokens.ts` / `app/globals.css` (bg-destructive, text-success, bg-warning, text-info, etc.).";

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

/**
 * Grandfathered raw-color-utility offenders as of the design-token
 * refactor. Tracked for migration in a follow-up ticket; do NOT add new
 * entries — new code must use semantic tokens. Billing
 * (`components/billing/**`, `components/profile/tabs/billing-tab.tsx`)
 * is grandfathered because a separate audit owns that surface.
 */
const RAW_COLOR_GRANDFATHERED = [
  "app/billing/success/page.tsx",
  "components/billing/**",
  "components/profile/tabs/billing-tab.tsx",
];

/**
 * Grandfathered raw-heading offenders. Broader than the color list
 * because almost every page/section uses a bare <h1>/<h2> today. Same
 * no-new-entries policy.
 */
const RAW_HEADING_GRANDFATHERED = [
  "app/about/page.tsx",
  "app/billing/success/page.tsx",
  "components/billing/**",
  "components/profile/tabs/billing-tab.tsx",
  "components/round/**",
];

const BASELINE_IGNORES = [
  "components/ui/**",
  "emails/**",
  "supabase/functions/**",
  "eslint.config.mjs",
];

const HEADING_ONLY = RAW_HEADING_GRANDFATHERED.filter(
  (p) => !RAW_COLOR_GRANDFATHERED.includes(p)
);
const COLOR_ONLY = RAW_COLOR_GRANDFATHERED.filter(
  (p) => !RAW_HEADING_GRANDFATHERED.includes(p)
);
const BOTH = RAW_COLOR_GRANDFATHERED.filter((p) =>
  RAW_HEADING_GRANDFATHERED.includes(p)
);

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
  // --- Design-system guardrails (tiered so both selector sets coexist) ---
  {
    // Default tier: BOTH color + heading rules apply.
    files: ["**/*.{ts,tsx,js,jsx,mjs,cjs}"],
    ignores: [
      ...BASELINE_IGNORES,
      ...RAW_COLOR_GRANDFATHERED,
      ...RAW_HEADING_GRANDFATHERED,
    ],
    rules: {
      "no-restricted-syntax": [
        "error",
        ...colorSelectors,
        ...headingSelectors,
      ],
    },
  },
  // Tier blocks are emitted only when their derived file list is
  // non-empty — flat config rejects empty `files` arrays.
  ...(HEADING_ONLY.length > 0
    ? [
        {
          // Grandfathered for HEADINGS only — still enforce colors.
          files: HEADING_ONLY,
          ignores: [...BASELINE_IGNORES, ...RAW_COLOR_GRANDFATHERED],
          rules: {
            "no-restricted-syntax": ["error", ...colorSelectors],
          },
        },
      ]
    : []),
  ...(COLOR_ONLY.length > 0
    ? [
        {
          // Grandfathered for COLORS only — still enforce headings.
          files: COLOR_ONLY,
          ignores: [...BASELINE_IGNORES, ...RAW_HEADING_GRANDFATHERED],
          rules: {
            "no-restricted-syntax": ["error", ...headingSelectors],
          },
        },
      ]
    : []),
  ...(BOTH.length > 0
    ? [
        {
          // Grandfathered for BOTH — disable the rule entirely.
          files: BOTH,
          rules: {
            "no-restricted-syntax": "off",
          },
        },
      ]
    : []),
];

export default eslintConfig;
