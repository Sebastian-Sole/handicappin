/**
 * Native font-face registry — the single source for bundled face names.
 *
 * The web app loads Inter through next/font (--font-inter); the native app
 * will bundle Inter via @expo-google-fonts/inter, whose static faces carry
 * their own weight. nativeFaceFor() maps a generated TypeSpec onto the
 * correct bundled face so className typography and runtime font selection
 * agree by construction. The future apps/native font loader must register
 * exactly these names.
 */

export const FONT_FACES = {
  regular: "Inter_400Regular",
  medium: "Inter_500Medium",
  semibold: "Inter_600SemiBold",
  bold: "Inter_700Bold",
  extrabold: "Inter_800ExtraBold",
};

/**
 * Pick the bundled native face for a typography spec.
 * Returns { fontFamily } — the face name carries the weight, so no
 * font-weight is emitted alongside it (RN static faces ignore it anyway).
 * Size-only utilities (text-meta, text-hero-*) have no weight and inherit
 * family/weight from composition — emit nothing family-related for them.
 */
export function nativeFaceFor(spec) {
  const w = spec.fontWeight;
  if (w == null) return {};
  if (w >= 800) return { fontFamily: FONT_FACES.extrabold };
  if (w >= 700) return { fontFamily: FONT_FACES.bold };
  if (w >= 600) return { fontFamily: FONT_FACES.semibold };
  if (w >= 500) return { fontFamily: FONT_FACES.medium };
  return { fontFamily: FONT_FACES.regular };
}
