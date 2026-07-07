/**
 * Bottom tab shell (decision ledger §1: Home, Rounds, Statistics, Profile;
 * auth stack lives outside). Every tab maps to a SHARED route (D5): the
 * dynamic tabs (Rounds → dashboard/[id], Profile → profile/[id]) get their
 * concrete href from the session. Logged-out users redirect to /login.
 *
 * The center slot is a prominent circular (+) action (user-directed
 * native pattern, D17) that opens the add-round modal — its backing route
 * ("add") is a redirect-only stub declared in INTENTIONAL.nativeOnly.
 * rounds/[id]/calculation and calculators live INSIDE this navigator as
 * href:null screens so the tab bar stays visible on them (D17).
 */
import { Redirect, router, Tabs } from "expo-router";
import { BarChart2, Home, List, Plus, User } from "lucide-react-native";
import { useState } from "react";
import { Pressable, View, type StyleProp, type ViewStyle } from "react-native";

import { tokens } from "@handicappin/tokens/tokens";
import { StartRoundSheet } from "@/components/live-round/start-round-sheet";
import { useSession } from "@/lib/auth/session-provider";
import { useColorMode } from "@/lib/color-mode";
import { useOwnedRoundSession } from "@/lib/round-session/use-owned-session";

const PLUS_ICON_SIZE = 28; // allow-hardcoded lucide icon prop sized to the 56px action button

function AddRoundTabButton({ style }: { style?: StyleProp<ViewStyle> }) {
  const mode = useColorMode();
  // Live round in progress: (+) jumps straight back into it (zero-friction
  // resume, badge dot signals the state). Otherwise it offers the two entry
  // modes (live vs scorecard) via a bottom sheet. Owned-session hook: a
  // round persisted by a DIFFERENT account on this device reads as none.
  const liveSession = useOwnedRoundSession();
  const [sheetOpen, setSheetOpen] = useState(false);
  return (
    <View style={style} className="items-center justify-center">
      <Pressable
        testID="tab-add-round"
        accessibilityRole="button"
        accessibilityLabel={
          liveSession ? "Resume live round" : "Log a new round"
        }
        onPress={() => {
          if (liveSession) {
            router.push("/rounds/live");
          } else {
            setSheetOpen(true);
          }
        }}
        // Token-fed lift so the circle floats half out of the bar.
        style={{ marginTop: -tokens.spacing.lg }}
        className="h-14 w-14 items-center justify-center rounded-full border-4 border-background bg-primary active:opacity-90"
      >
        <Plus
          size={PLUS_ICON_SIZE}
          color={tokens.colors[mode]["primary-foreground"]}
        />
        {liveSession ? (
          <View
            testID="tab-add-round-live-badge"
            className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-warning border-2 border-background"
          />
        ) : null}
      </Pressable>
      <StartRoundSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
      />
    </View>
  );
}

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
          tabBarButtonTestID: "tab-home",
          tabBarIcon: ({ color, size }) => <Home size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="dashboard/[id]"
        options={{
          title: "Rounds",
          href: `/dashboard/${session.user.id}`,
          tabBarButtonTestID: "tab-rounds",
          tabBarIcon: ({ color, size }) => <List size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="add"
        options={{
          title: "Add round",
          tabBarButton: ({ style }) => <AddRoundTabButton style={style} />,
        }}
      />
      <Tabs.Screen
        name="statistics"
        options={{
          title: "Statistics",
          tabBarButtonTestID: "tab-statistics",
          tabBarIcon: ({ color, size }) => (
            <BarChart2 size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile/[id]"
        options={{
          title: "Profile",
          href: `/profile/${session.user.id}`,
          tabBarButtonTestID: "tab-profile",
          tabBarIcon: ({ color, size }) => <User size={size} color={color} />,
        }}
      />
      {/* Routes that keep the tab bar but own no tab slot. */}
      <Tabs.Screen name="rounds/[id]/calculation" options={{ href: null }} />
      <Tabs.Screen name="calculators" options={{ href: null }} />
    </Tabs>
  );
}
