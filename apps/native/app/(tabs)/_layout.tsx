/**
 * Bottom tab shell (decision ledger §1: Home, Rounds, Statistics, Profile;
 * auth stack lives outside). Every tab maps to a SHARED route (D5): the
 * dynamic tabs (Rounds → dashboard/[id], Profile → profile/[id]) get their
 * concrete href from the session. Logged-out users redirect to /login.
 *
 * Tabs register as their screens port; until a screen lands its Tabs.Screen
 * entry simply doesn't exist yet (the gate keeps slugs honest).
 */
import { Redirect, Tabs } from "expo-router";
import { Home } from "lucide-react-native";

import { tokens } from "@handicappin/tokens/tokens";
import { useSession } from "@/lib/auth/session-provider";
import { useColorMode } from "@/lib/color-mode";

export default function TabsLayout() {
  const { session, initializing } = useSession();
  const mode = useColorMode();

  if (initializing) return null;
  if (!session) return <Redirect href="/login" />;

  const colors = tokens.colors[mode];

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors["muted-foreground"],
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => <Home size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
