import "../global.css";

import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { tokens } from "@handicappin/tokens/tokens";

import { SessionProvider } from "@/lib/auth/session-provider";
import { useColorMode } from "@/lib/color-mode";
import { FONTS_READY_TEST_ID, useAppFonts } from "@/lib/fonts";
import { QueryProvider } from "@/lib/query/provider";

// Hold the splash from module load so text never paints before the Inter
// faces resolve — otherwise cold launches FOUT and the capture gate sees a
// non-deterministic font state (pattern from the ks-digital reference).
SplashScreen.preventAutoHideAsync().catch(() => {
  // No-op: preventing twice (fast refresh) is harmless.
});

export default function RootLayout() {
  const { fontsReady } = useAppFonts();
  const mode = useColorMode();

  useEffect(() => {
    if (fontsReady) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsReady]);

  // Render nothing under the splash until fonts are ready — the single
  // font-ready gate the verification harness also waits on.
  if (!fontsReady) return null;

  return (
    <QueryProvider>
      <SessionProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <SafeAreaProvider>
            {/* Zero-size marker the Maestro/capture harness asserts on. */}
            <View
              testID={FONTS_READY_TEST_ID}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={{ width: 0, height: 0 }}
            />
            {/* contentStyle: the navigator's card is BLACK by default, and
                it's visible mid-transition (most obviously as a dark sheet
                sliding up ahead of the fullScreenModal content). Painting
                the card the app background makes transitions seamless. */}
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: {
                  backgroundColor: tokens.colors[mode].background,
                },
              }}
            >
              {/* Full-screen modal with an explicit in-screen close (D17). */}
              <Stack.Screen
                name="rounds/add"
                options={{ presentation: "fullScreenModal" }}
              />
              {/* Live scoring flow (setup → hole screen → review as a nested
                  stack). Swipe-dismiss disabled: the session survives
                  regardless (SQLite-backed), but an accidental dismiss
                  mid-round shouldn't cost the user their place. */}
              <Stack.Screen
                name="rounds/live"
                options={{
                  presentation: "fullScreenModal",
                  gestureEnabled: false,
                }}
              />
            </Stack>
            <StatusBar style="auto" />
          </SafeAreaProvider>
        </GestureHandlerRootView>
      </SessionProvider>
    </QueryProvider>
  );
}
