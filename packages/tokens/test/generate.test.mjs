import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  oklchToHex,
  cssColorToHex,
  hexWithAlpha,
  resolveColorMix,
  resolveColorValue,
  resolveRadiusValue,
  resolveTrackingValue,
  parseShadow,
  parseRemPx,
  parseLengthToPx,
  parseDurationToMs,
  parseCubicBezier,
  splitTopLevelCommas,
  buildSpacingScale,
  resolveFontStack,
  buildModel,
  serializeTokensTs,
  serializeNativeGlobalCss,
  loadConfig,
} from "../src/generate.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

describe("color conversion", () => {
  it("oklch → hex (in gamut)", () => {
    assert.equal(cssColorToHex("oklch(1 0 0)"), "#ffffff");
    assert.equal(cssColorToHex("oklch(0 0 0)"), "#000000");
  });

  it("oklch with alpha → hex8", () => {
    assert.equal(cssColorToHex("oklch(0 0 0 / 0.8)"), "#000000cc");
  });

  it("oklch out of gamut is chroma-mapped, not clipped to garbage", () => {
    const hex = oklchToHex(0.5, 0.4, 150);
    assert.match(hex, /^#[0-9a-f]{6}$/);
  });

  it("hex passthrough lowercases", () => {
    assert.equal(cssColorToHex("#ABCDEF"), "#abcdef");
  });

  it("rgb space and comma syntax", () => {
    assert.equal(cssColorToHex("rgb(0 0 0 / 0.1)"), "#0000001a");
    assert.equal(cssColorToHex("rgba(255, 255, 255, 0.5)"), "#ffffff80");
  });

  it("hexWithAlpha multiplies existing alpha", () => {
    assert.equal(hexWithAlpha("#ff0000", 0.1), "#ff00001a");
    assert.equal(hexWithAlpha("#ff000080", 0.5), "#ff000040");
  });
});

describe("resolveColorMix", () => {
  const resolver = (expr) =>
    expr === "var(--color-primary)" ? "#006b27" : cssColorToHex(expr);

  it("resolves color-mix over transparent to base at N% alpha", () => {
    assert.equal(
      resolveColorMix("color-mix(in oklab, var(--color-primary) 10%, transparent)", resolver),
      "#006b271a",
    );
    assert.equal(
      resolveColorMix("color-mix(in oklab, var(--color-primary) 20%, transparent)", resolver),
      "#006b2733",
    );
  });

  it("returns null for non-transparent mixes", () => {
    assert.equal(
      resolveColorMix("color-mix(in srgb, red 50%, blue)", resolver),
      null,
    );
  });
});

describe("resolveRadiusValue (additive calc — this repo's scale)", () => {
  const base = 0.5; // --radius: 0.5rem
  it("calc(var(--radius) - 4px)", () => {
    assert.deepEqual(resolveRadiusValue("calc(var(--radius) - 4px)", base), {
      px: 4,
      rem: 0.25,
    });
  });
  it("calc(var(--radius) + 4px)", () => {
    assert.deepEqual(resolveRadiusValue("calc(var(--radius) + 4px)", base), {
      px: 12,
      rem: 0.75,
    });
  });
  it("bare var(--radius)", () => {
    assert.deepEqual(resolveRadiusValue("var(--radius)", base), { px: 8, rem: 0.5 });
  });
  it("multiplicative form still supported (ks-digital portability)", () => {
    assert.deepEqual(resolveRadiusValue("calc(var(--radius) * 0.5)", base), {
      px: 4,
      rem: 0.25,
    });
  });
  it("literal px / rem / unknown", () => {
    assert.deepEqual(resolveRadiusValue("9999px", base), { px: 9999, rem: 624.9375 });
    assert.equal(resolveRadiusValue("inherit", base), null);
  });
});

describe("resolveTrackingValue", () => {
  const base = 0.025;
  it("calc(var(--tracking-normal) ± Nem)", () => {
    assert.equal(resolveTrackingValue("calc(var(--tracking-normal) - 0.05em)", base), -0.025);
    assert.equal(resolveTrackingValue("calc(var(--tracking-normal) + 0.1em)", base), 0.125);
  });
  it("bare var and literal em", () => {
    assert.equal(resolveTrackingValue("var(--tracking-normal)", base), 0.025);
    assert.equal(resolveTrackingValue("0.05em", base), 0.05);
  });
});

describe("shadow parsing", () => {
  it("multi-layer with oklch colors", () => {
    const layers = parseShadow(
      "0px 4px 6px -1px oklch(0.2 0.03 145 / 0.1), 0 1px 2px rgb(0 0 0 / 0.05)",
    );
    assert.equal(layers.length, 2);
    assert.equal(layers[0].blur, 6);
    assert.equal(layers[0].spread, -1);
    assert.match(layers[0].color, /^#[0-9a-f]{8}$/);
  });

  it("rem lengths convert to px (this repo's --shadow-2xl uses 0.5rem)", () => {
    const [layer] = parseShadow("0px 2px 0.5rem 0px oklch(0.2 0.03 145 / 0.13)");
    assert.equal(layer.blur, 8);
  });
});

describe("misc parsers", () => {
  it("parseRemPx", () => {
    assert.deepEqual(parseRemPx("18.75rem"), { px: 300, rem: 18.75 });
    assert.deepEqual(parseRemPx("320px"), { px: 320, rem: 20 });
  });
  it("parseLengthToPx is rem-aware", () => {
    assert.equal(parseLengthToPx("0.5rem"), 8);
    assert.equal(parseLengthToPx("-12px"), -12);
  });
  it("durations and beziers", () => {
    assert.equal(parseDurationToMs("0.35s"), 350);
    assert.deepEqual(parseCubicBezier("cubic-bezier(0.2, 0.6, 0.4, 1)"), [0.2, 0.6, 0.4, 1]);
    assert.equal(parseCubicBezier("ease-out"), null);
  });
  it("splitTopLevelCommas respects parens", () => {
    assert.deepEqual(splitTopLevelCommas("a, rgb(0, 0, 0), b"), ["a", "rgb(0, 0, 0)", "b"]);
  });
  it("buildSpacingScale", () => {
    const s = buildSpacingScale(4);
    assert.equal(s["4"], 16);
    assert.equal(s["0.5"], 2);
  });
  it("resolveFontStack prefers config fonts for self-referential slots", () => {
    const stack = resolveFontStack(
      "var(--font-sans)",
      new Map([["--font-sans", "var(--font-sans)"]]),
      { sans: "Inter, system-ui" },
    );
    assert.equal(stack, "Inter, system-ui");
  });
});

// ---------------------------------------------------------------------------
// buildModel — synthetic fixture exercising every adaptation
// ---------------------------------------------------------------------------

const FIXTURE_GLOBALS = `
@theme inline {
  --color-primary: var(--primary);
  --color-overlay: var(--overlay);
  --breakpoint-*: initial;
  --breakpoint-xs: 320px;
  --radius-sm: calc(var(--radius) - 4px);
  --radius-lg: var(--radius);
  --spacing-md: 1rem;
  --size-chart-frame: 18.75rem;
  --tracking-tight: calc(var(--tracking-normal) - 0.025em);
  --shadow: var(--shadow);
  --shadow-sm: var(--shadow-sm);
  --font-sans: var(--font-sans);
}
:root {
  --primary: oklch(0.46 0.16 148);
  --overlay: oklch(0 0 0 / 0.8);
  --radius: 0.5rem;
  --spacing: 0.25rem;
  --tracking-normal: 0.025em;
  --shadow: 0px 10px 15px -3px oklch(0.2 0.03 145 / 0.1);
  --shadow-sm: 0px 4px 6px -1px oklch(0.2 0.03 145 / 0.1);
}
.dark {
  --primary: oklch(0.55 0.16 148);
}
`;

const FIXTURE_TYPOGRAPHY = `
@utility text-heading-1 {
  font-family: var(--font-sans);
  font-weight: 800;
  font-size: 2.25rem;
  line-height: 2.5rem;
  letter-spacing: -0.02em;
}
@utility text-figure-2xl {
  font-weight: 700;
  font-size: 3rem;
  line-height: 1;
}
@utility text-meta {
  font-size: 0.75rem;
  line-height: 1rem;
}
@utility text-eyebrow {
  font-size: 0.75rem;
  line-height: 1rem;
  font-weight: 500;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}
`;

const FIXTURE_SURFACES = `
@utility tint-primary {
  background-color: color-mix(in oklab, var(--color-primary) 10%, transparent);
  border: 1px solid color-mix(in oklab, var(--color-primary) 20%, transparent);
  border-radius: var(--radius-lg);
}
@utility chip-primary {
  display: inline-flex;
  align-items: center;
  padding: var(--spacing-md) var(--spacing-md);
  border-radius: 9999px;
  background-color: color-mix(in oklab, var(--color-primary) 10%, transparent);
  color: var(--color-primary);
}
@utility hero-gradient {
  background-image: linear-gradient(to bottom right, red, blue);
}
@utility max-w-xs { max-width: 20rem !important; }
`;

const FIXTURE_CONFIG = {
  source: "fixture.css",
  themeInlineBlock: "@theme inline",
  lightSelector: ":root",
  darkSelector: ".dark",
  remBasePx: 16,
  fonts: { sans: "Inter, system-ui", mono: "Menlo", serif: "Georgia" },
  surfaceUtilityPrefixes: ["surface", "tint-", "chip-"],
};

function buildFixtureModel() {
  return buildModel(
    {
      globals: FIXTURE_GLOBALS,
      typography: FIXTURE_TYPOGRAPHY,
      surfaces: FIXTURE_SURFACES,
    },
    FIXTURE_CONFIG,
  );
}

describe("buildModel (synthetic fixture)", () => {
  const { tokens, counts, skippedSurfaces } = buildFixtureModel();

  it("resolves colors per mode with dark fallback to light", () => {
    assert.equal(tokens.colors.light.primary, oklchToHex(0.46, 0.16, 148));
    assert.equal(tokens.colors.dark.primary, oklchToHex(0.55, 0.16, 148));
    // overlay not overridden in .dark — falls back to light
    assert.equal(tokens.colors.dark.overlay, tokens.colors.light.overlay);
    assert.equal(tokens.colors.light.overlay, "#000000cc");
  });

  it("skips the --breakpoint-* namespace reset but keeps real breakpoints", () => {
    assert.deepEqual(tokens.breakpoints, { xs: 320 });
  });

  it("resolves additive radius calc against the rem base", () => {
    assert.equal(tokens.radii.sm, 4);
    assert.equal(tokens.radii.lg, 8);
  });

  it("captures semantic spacing, sizes, tracking", () => {
    assert.equal(tokens.spacing.md, 16);
    assert.equal(tokens.sizes["chart-frame"], 300);
    assert.equal(tokens.tracking.tight, 0);
  });

  it("resolves self-referential shadow slots through :root incl. bare --shadow", () => {
    assert.ok(tokens.shadows.DEFAULT);
    assert.equal(tokens.shadows.DEFAULT[0].blur, 15);
    assert.ok(tokens.shadows.sm);
  });

  it("parses @utility typography with em→px letter-spacing", () => {
    const h1 = tokens.typography["text-heading-1"];
    assert.equal(h1.fontSize, 36);
    assert.equal(h1.letterSpacingEm, -0.02);
    assert.equal(h1.letterSpacing, -0.72);
    assert.equal(h1.fontFamily, "Inter, system-ui");
  });

  it("expands unitless line-height against font size", () => {
    const fig = tokens.typography["text-figure-2xl"];
    assert.equal(fig.fontSize, 48);
    assert.equal(fig.lineHeight, 48);
  });

  it("keeps size-only utilities weight- and family-free", () => {
    const meta = tokens.typography["text-meta"];
    assert.equal(meta.fontWeight, undefined);
    assert.equal(meta.fontFamily, undefined);
  });

  it("resolves surfaces per mode (color-mix → alpha hex)", () => {
    const L = tokens.surfaces.light["tint-primary"];
    const D = tokens.surfaces.dark["tint-primary"];
    assert.equal(L.backgroundColor, oklchToHex(0.46, 0.16, 148) + "1a");
    assert.equal(D.backgroundColor, oklchToHex(0.55, 0.16, 148) + "1a");
    assert.equal(L.borderColor, oklchToHex(0.46, 0.16, 148) + "33");
    assert.equal(L.borderWidth, 1);
    assert.equal(L.borderRadius, 8);
  });

  it("resolves chip paddings from the semantic ramp and drops display", () => {
    const chip = tokens.surfaces.light["chip-primary"];
    assert.equal(chip.paddingVertical, 16);
    assert.equal(chip.borderRadius, 9999);
    assert.equal(chip.color, oklchToHex(0.46, 0.16, 148));
    assert.equal("display" in chip, false);
  });

  it("skips out-of-contract utilities (gradients, container workarounds)", () => {
    assert.ok(skippedSurfaces.includes("hero-gradient"));
    assert.ok(skippedSurfaces.includes("max-w-xs"));
    assert.equal(counts.surfaces, 2);
  });
});

describe("serializers", () => {
  const model = buildFixtureModel();

  it("tokens.ts is valid JSON payload and deterministic", () => {
    const a = serializeTokensTs(model.tokens, "fixture.css");
    const b = serializeTokensTs(model.tokens, "fixture.css");
    assert.equal(a, b);
    const marker = "export const tokens: Tokens = ";
    const json = a.slice(a.indexOf(marker) + marker.length).replace(/;\s*$/, "");
    const parsed = JSON.parse(json);
    assert.equal(parsed.colors.light.primary, model.tokens.colors.light.primary);
  });

  it("native css emits @theme inline slots, per-mode vars, ramp and surfaces", () => {
    const css = serializeNativeGlobalCss(model, "fixture.css");
    assert.ok(css.includes("--color-primary: var(--primary);"));
    // Dark vars MUST ride prefers-color-scheme (react-native-css maps it to
    // the OS Appearance API). A `.dark` class block compiles but never
    // activates on native — there is no DOM node to carry the class.
    assert.ok(css.includes("@media (prefers-color-scheme: dark)"));
    assert.ok(!css.includes(".dark {"));
    assert.ok(
      css.includes("@custom-variant dark (@media (prefers-color-scheme: dark));"),
    );
    assert.ok(css.includes("@utility text-heading-1"));
    assert.ok(css.includes("font-family: Inter_800ExtraBold;"));
    assert.ok(css.includes("@utility tint-primary"));
    assert.ok(css.includes("var(--sf-tint-primary-bg)"));
    // comments may mention color-mix; no actual color-mix() calls survive
    assert.ok(!css.includes("color-mix("));
    assert.ok(!css.includes("oklch("));
  });
});

// ---------------------------------------------------------------------------
// Real-source smoke test — the actual repo CSS must build a sane model
// ---------------------------------------------------------------------------

describe("real sources (smoke)", () => {
  it("builds from the repo's actual CSS with expected shape", () => {
    const config = loadConfig(resolve(__dirname, "../theme.config.json"));
    const pkgRoot = resolve(__dirname, "..");
    const css = {
      globals: readFileSync(resolve(pkgRoot, config.source), "utf-8"),
      typography: readFileSync(resolve(pkgRoot, config.typographySource), "utf-8"),
      surfaces: readFileSync(resolve(pkgRoot, config.surfacesSource), "utf-8"),
    };
    const { tokens, counts } = buildModel(css, config);
    assert.ok(counts.colorsLight >= 40, `colorsLight=${counts.colorsLight}`);
    assert.equal(counts.colorsLight, counts.colorsDark);
    assert.ok(tokens.colors.light.primary.startsWith("#"));
    assert.notEqual(tokens.colors.light.primary, tokens.colors.dark.primary);
    assert.ok(counts.typography >= 25, `typography=${counts.typography}`);
    assert.ok(counts.surfaces >= 25, `surfaces=${counts.surfaces}`);
    assert.ok(tokens.shadows.DEFAULT, "bare --shadow tier present");
    assert.deepEqual(Object.keys(tokens.spacing), [
      "xs", "sm", "md", "lg", "xl", "2xl", "3xl", "4xl", "5xl",
    ]);
  });
});
