import "../global.css";

import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { FONTS_READY_TEST_ID, useAppFonts } from "@/lib/fonts";

// Hold the splash from module load so text never paints before the Inter
// faces resolve — otherwise cold launches FOUT and the capture gate sees a
// non-deterministic font state (pattern from the ks-digital reference).
SplashScreen.preventAutoHideAsync().catch(() => {
  // No-op: preventing twice (fast refresh) is harmless.
});

export default function RootLayout() {
  const { fontsReady } = useAppFonts();

  useEffect(() => {
    if (fontsReady) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsReady]);

  // Render nothing under the splash until fonts are ready — the single
  // font-ready gate the verification harness also waits on.
  if (!fontsReady) return null;

  return (
    <SafeAreaProvider>
      {/* Zero-size marker the Maestro/capture harness asserts on. */}
      <View
        testID={FONTS_READY_TEST_ID}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ width: 0, height: 0 }}
      />
      <Stack screenOptions={{ headerShown: false }} />
      <StatusBar style="auto" />
    </SafeAreaProvider>
  );
}
