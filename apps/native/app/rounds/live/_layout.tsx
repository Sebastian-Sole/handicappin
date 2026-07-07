/**
 * Live-round flow: nested stack inside the fullScreenModal registered in
 * the root layout. setup → index (hole screen) → review navigate within
 * this stack without dismissing the modal.
 */
import { Stack } from "expo-router";

import { tokens } from "@handicappin/tokens/tokens";

import { useColorMode } from "@/lib/color-mode";

export default function LiveRoundLayout() {
  const mode = useColorMode();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        // Same card-background fix as the root stack — without it the
        // nested navigator flashes its default black card on transitions.
        contentStyle: { backgroundColor: tokens.colors[mode].background },
      }}
    />
  );
}
