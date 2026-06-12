/**
 * Font loading for the native app.
 *
 * Bundles the Inter static faces via @expo-google-fonts/inter. The face NAMES
 * are the contract: they must match packages/tokens/src/font-faces.mjs
 * (FONT_FACES), which is what the generated typography `@utility text-*`
 * ramp and tokens.typography reference. expo-font registers each static face
 * under its export name (e.g. "Inter_700Bold"), so className typography and
 * runtime font selection agree by construction.
 */
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  useFonts,
} from "@expo-google-fonts/inter";

/** Zero-size marker the Maestro/capture harness asserts on. */
export const FONTS_READY_TEST_ID = "fonts-ready";

export const fontAssets = {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
};

/**
 * Load the bundled fonts and expose a single `fontsReady` boolean — the ONE
 * font-ready signal: the splash gate in the root layout holds on it, and the
 * verification harness reads the same signal via the fonts-ready test marker.
 */
export function useAppFonts(): { fontsReady: boolean; fontError: Error | null } {
  const [loaded, error] = useFonts(fontAssets);
  // Treat an error as "ready" so a single missing face can never wedge the
  // splash screen; the harness's glyph checks catch the visual fallout.
  return { fontsReady: loaded || error != null, fontError: error ?? null };
}
