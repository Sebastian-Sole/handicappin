/**
 * Current color mode for places className can't reach (placeholder colors,
 * chart props, gradient stops). Mirrors how the generated theme switches:
 * the system scheme drives `:root`/`.dark` vars; this hook resolves the same
 * mode for `tokens.colors[mode]` / `tokens.surfaces[mode]` lookups.
 */
import { useColorScheme } from "react-native";

export type ColorMode = "light" | "dark";

export function useColorMode(): ColorMode {
  return useColorScheme() === "dark" ? "dark" : "light";
}
