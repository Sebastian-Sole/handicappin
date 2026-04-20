/**
 * Design Tokens — Single Source of Truth
 *
 * This module is the portable source of truth for the handicappin' design
 * system. It is intentionally plain JS/TS (no CSS imports, no Tailwind
 * imports) so the upcoming React Native app can consume it without any
 * web-specific adapters.
 *
 * The web app exposes these tokens via CSS custom properties declared in
 * `app/globals.css`. When you add or change a token here, mirror the change
 * in `app/globals.css` (both the `:root` / `.dark` blocks and the `@theme`
 * block). Keep token names in lockstep with the CSS variable names (minus
 * the leading `--color-` / `--` prefix) so look-ups stay obvious.
 *
 * OKLCH values are the design source of truth. The `hex` fallbacks exist
 * for RN consumers that do not natively resolve oklch and for any
 * environment where a concrete sRGB value is required (charts, generated
 * images, email stylesheets). Hex values were derived by eye-rounding the
 * oklch values through a reference converter; they should stay in sync
 * with the oklch source when the palette is re-tuned.
 */

// -----------------------------------------------------------------------------
// Colors
// -----------------------------------------------------------------------------

export interface ColorToken {
  /** Authoritative OKLCH string — mirrors the CSS variable definition. */
  oklch: string;
  /** Pre-resolved sRGB hex fallback for environments without oklch support. */
  hex: string;
}

export interface ColorPair {
  DEFAULT: ColorToken;
  foreground: ColorToken;
}

export interface ThemeColors {
  background: ColorToken;
  backgroundAlternate: ColorToken;
  foreground: ColorToken;

  card: ColorPair;
  popover: ColorPair;

  primary: ColorPair & { alternate: ColorToken };
  secondary: ColorPair;
  muted: ColorPair;
  accent: ColorPair;

  destructive: ColorPair;
  success: ColorPair;
  warning: ColorPair;
  info: ColorPair;

  border: ColorToken;
  input: ColorToken;
  ring: ColorToken;

  chart1: ColorToken;
  chart2: ColorToken;
  chart3: ColorToken;
  chart4: ColorToken;
  chart5: ColorToken;
}

const token = (oklch: string, hex: string): ColorToken => ({ oklch, hex });

const lightColors: ThemeColors = {
  background: token("oklch(0.985 0.002 160)", "#F7F9F8"),
  backgroundAlternate: token("oklch(0.96 0.005 160)", "#EDF1EF"),
  foreground: token("oklch(0.2 0.03 145)", "#1B2A22"),

  card: {
    DEFAULT: token("oklch(1 0 0)", "#FFFFFF"),
    foreground: token("oklch(0.2 0.03 145)", "#1B2A22"),
  },
  popover: {
    DEFAULT: token("oklch(1 0 0)", "#FFFFFF"),
    foreground: token("oklch(0.2 0.03 145)", "#1B2A22"),
  },

  primary: {
    DEFAULT: token("oklch(0.46 0.16 148)", "#2E7A41"),
    foreground: token("oklch(0.98 0 0)", "#FAFAFA"),
    alternate: token("oklch(0.4 0.16 148)", "#276635"),
  },
  secondary: {
    DEFAULT: token("oklch(0.88 0.08 90)", "#E8D9A6"),
    foreground: token("oklch(0.25 0.05 90)", "#3A3322"),
  },
  muted: {
    DEFAULT: token("oklch(0.94 0.01 200)", "#E9ECEE"),
    foreground: token("oklch(0.5 0.02 200)", "#6E7B82"),
  },
  accent: {
    DEFAULT: token("oklch(0.92 0.06 140)", "#D4E6CC"),
    foreground: token("oklch(0.25 0.1 145)", "#1F3A27"),
  },

  destructive: {
    DEFAULT: token("oklch(0.55 0.2 25)", "#C23A2E"),
    foreground: token("oklch(0.98 0.005 240)", "#FAFAFA"),
  },
  success: {
    DEFAULT: token("oklch(0.58 0.15 150)", "#3F9A57"),
    foreground: token("oklch(0.98 0 0)", "#FAFAFA"),
  },
  warning: {
    DEFAULT: token("oklch(0.78 0.14 75)", "#E0A94A"),
    foreground: token("oklch(0.2 0.03 145)", "#1B2A22"),
  },
  info: {
    DEFAULT: token("oklch(0.6 0.14 240)", "#3A7BB8"),
    foreground: token("oklch(0.98 0 0)", "#FAFAFA"),
  },

  border: token("oklch(0.9 0.01 160)", "#DDE2DF"),
  input: token("oklch(0.9 0.01 160)", "#DDE2DF"),
  ring: token("oklch(0.46 0.16 148)", "#2E7A41"),

  chart1: token("oklch(0.46 0.16 148)", "#2E7A41"),
  chart2: token("oklch(0.6 0.05 200)", "#7B8E96"),
  chart3: token("oklch(0.7 0.15 70)", "#D08A3A"),
  chart4: token("oklch(0.55 0.2 25)", "#C23A2E"),
  chart5: token("oklch(0.85 0.15 90)", "#E6C452"),
};

const darkColors: ThemeColors = {
  background: token("oklch(0.14 0.04 150)", "#0E1C14"),
  backgroundAlternate: token("oklch(0.18 0.04 150)", "#17281D"),
  foreground: token("oklch(0.96 0.01 160)", "#F0F3F0"),

  card: {
    DEFAULT: token("oklch(0.18 0.04 150)", "#17281D"),
    foreground: token("oklch(0.96 0.01 160)", "#F0F3F0"),
  },
  popover: {
    DEFAULT: token("oklch(0.18 0.04 150)", "#17281D"),
    foreground: token("oklch(0.96 0.01 160)", "#F0F3F0"),
  },

  primary: {
    DEFAULT: token("oklch(0.55 0.16 148)", "#3A9655"),
    foreground: token("oklch(0.98 0 0)", "#FAFAFA"),
    alternate: token("oklch(0.45 0.16 148)", "#2C7640"),
  },
  secondary: {
    DEFAULT: token("oklch(0.3 0.05 90)", "#483E27"),
    foreground: token("oklch(0.9 0.05 90)", "#E8D9A6"),
  },
  muted: {
    DEFAULT: token("oklch(0.25 0.02 150)", "#283229"),
    foreground: token("oklch(0.7 0.02 150)", "#A3B0A6"),
  },
  accent: {
    DEFAULT: token("oklch(0.25 0.05 145)", "#243A2B"),
    foreground: token("oklch(0.9 0.05 145)", "#CFE2D5"),
  },

  destructive: {
    DEFAULT: token("oklch(0.6 0.2 25)", "#D54536"),
    foreground: token("oklch(0.98 0 0)", "#FAFAFA"),
  },
  success: {
    DEFAULT: token("oklch(0.62 0.15 150)", "#4BA962"),
    foreground: token("oklch(0.98 0 0)", "#FAFAFA"),
  },
  warning: {
    DEFAULT: token("oklch(0.74 0.14 75)", "#CC9A42"),
    foreground: token("oklch(0.14 0.04 150)", "#0E1C14"),
  },
  info: {
    DEFAULT: token("oklch(0.66 0.14 240)", "#5A91C6"),
    foreground: token("oklch(0.98 0 0)", "#FAFAFA"),
  },

  border: token("oklch(0.28 0.03 150)", "#2E3A31"),
  input: token("oklch(0.28 0.03 150)", "#2E3A31"),
  ring: token("oklch(0.55 0.16 148)", "#3A9655"),

  chart1: token("oklch(0.55 0.16 148)", "#3A9655"),
  chart2: token("oklch(0.4 0.05 200)", "#4F5D66"),
  chart3: token("oklch(0.65 0.15 70)", "#C07E33"),
  chart4: token("oklch(0.6 0.2 25)", "#D54536"),
  chart5: token("oklch(0.85 0.15 90)", "#E6C452"),
};

export const colors = {
  light: lightColors,
  dark: darkColors,
} as const;

// -----------------------------------------------------------------------------
// Radius
// -----------------------------------------------------------------------------

/**
 * Radius scale. Web derives sm/md from the base `--radius` token; this
 * mirrors `app/globals.css` so RN can resolve the same scale numerically.
 */
export const radius = {
  base: "0.5rem", // 8px
  sm: "0.25rem", // base - 4px
  md: "0.375rem", // base - 2px
  lg: "0.5rem", // base
  xl: "0.75rem", // base + 4px
} as const;

export type RadiusKey = keyof typeof radius;

// -----------------------------------------------------------------------------
// Shadow
// -----------------------------------------------------------------------------

/**
 * Shadow scale. Web tokens use oklch-based colored shadows; RN consumers
 * should interpret these via `@shopify/react-native-skia` or a platform
 * shadow adapter. The `rgba` mirror exists so RN can use the hex colour
 * directly without parsing oklch.
 */
export const shadow = {
  "2xs": "0px 1px 2px 0px oklch(0.2 0.03 145 / 0.05)",
  xs: "0px 2px 4px 0px oklch(0.2 0.03 145 / 0.05)",
  sm: "0px 4px 6px -1px oklch(0.2 0.03 145 / 0.1)",
  DEFAULT: "0px 10px 15px -3px oklch(0.2 0.03 145 / 0.1)",
  md: "0px 15px 20px -5px oklch(0.2 0.03 145 / 0.1)",
  lg: "0px 20px 25px -5px oklch(0.2 0.03 145 / 0.1)",
  xl: "0px 25px 50px -12px oklch(0.2 0.03 145 / 0.25)",
  "2xl": "0px 2px 0.5rem 0px oklch(0.2 0.03 145 / 0.13)",
} as const;

export type ShadowKey = keyof typeof shadow;

// -----------------------------------------------------------------------------
// Spacing
// -----------------------------------------------------------------------------

/**
 * Semantic spacing ramp. This deliberately does NOT mirror Tailwind's
 * numeric scale — it provides named sizes that the RN app can consume
 * without inventing a new scale. The rem values keep the web rendering
 * identical to existing Tailwind usage.
 */
export const spacing = {
  xs: "0.25rem", // 4px
  sm: "0.5rem", // 8px
  md: "1rem", // 16px
  lg: "1.5rem", // 24px
  xl: "2rem", // 32px
  "2xl": "3rem", // 48px
} as const;

export type SpacingKey = keyof typeof spacing;

// -----------------------------------------------------------------------------
// Typography
// -----------------------------------------------------------------------------

export interface TypographyStyle {
  fontSize: string;
  lineHeight: string;
  fontWeight: number;
  /** CSS `letter-spacing` value. */
  letterSpacing: string;
}

/**
 * Semantic type ramp. Weights and sizes align with the current
 * `components/ui/typography.tsx` primitives so existing pages render
 * identically after the refactor.
 */
export const typography = {
  display: {
    fontSize: "3rem", // 48px
    lineHeight: "1",
    fontWeight: 800,
    letterSpacing: "-0.02em",
  },
  h1: {
    fontSize: "2.25rem", // 36px — matches text-4xl
    lineHeight: "2.5rem",
    fontWeight: 800,
    letterSpacing: "-0.02em",
  },
  h2: {
    fontSize: "1.875rem", // 30px — matches text-3xl
    lineHeight: "2.25rem",
    fontWeight: 600,
    letterSpacing: "-0.01em",
  },
  h3: {
    fontSize: "1.5rem", // 24px — matches text-2xl
    lineHeight: "2rem",
    fontWeight: 600,
    letterSpacing: "-0.01em",
  },
  h4: {
    fontSize: "1.25rem", // 20px — matches text-xl
    lineHeight: "1.75rem",
    fontWeight: 600,
    letterSpacing: "-0.005em",
  },
  body: {
    fontSize: "1rem", // 16px
    lineHeight: "1.75rem", // leading-7 — matches current <P>
    fontWeight: 400,
    letterSpacing: "0em",
  },
  bodySm: {
    fontSize: "0.875rem", // 14px
    lineHeight: "1.25rem",
    fontWeight: 400,
    letterSpacing: "0em",
  },
  caption: {
    fontSize: "0.75rem", // 12px
    lineHeight: "1rem",
    fontWeight: 500,
    letterSpacing: "0.01em",
  },
} as const satisfies Record<string, TypographyStyle>;

export type TypographyKey = keyof typeof typography;

// -----------------------------------------------------------------------------
// Tracking (letter-spacing)
// -----------------------------------------------------------------------------

/**
 * Letter-spacing scale. Values mirror the `--tracking-*` custom properties
 * in `app/globals.css`, which derive from `--tracking-normal` (0.025em).
 */
export const tracking = {
  tighter: "-0.025em", // normal - 0.05em
  tight: "0em", // normal - 0.025em
  normal: "0.025em",
  wide: "0.05em", // normal + 0.025em
  wider: "0.075em", // normal + 0.05em
  widest: "0.125em", // normal + 0.1em
} as const;

export type TrackingKey = keyof typeof tracking;

// -----------------------------------------------------------------------------
// Font family
// -----------------------------------------------------------------------------

export const fontFamily = {
  sans: [
    "Inter",
    "Manrope",
    "-apple-system",
    "BlinkMacSystemFont",
    "Segoe UI",
    "Roboto",
    "sans-serif",
  ],
  mono: [
    "ui-monospace",
    "Menlo",
    "Monaco",
    "Cascadia Mono",
    "Segoe UI Mono",
    "Roboto Mono",
    "Oxygen Mono",
    "Ubuntu Monospace",
    "Source Code Pro",
    "Fira Mono",
    "Droid Sans Mono",
    "Courier New",
    "monospace",
  ],
  serif: ["Merriweather", "Georgia", "serif"],
} as const;

export type FontFamilyKey = keyof typeof fontFamily;

// -----------------------------------------------------------------------------
// Default bundle — convenience for RN / theme providers
// -----------------------------------------------------------------------------

export const tokens = {
  colors,
  radius,
  shadow,
  spacing,
  typography,
  tracking,
  fontFamily,
} as const;

export type Tokens = typeof tokens;
