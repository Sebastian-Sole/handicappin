/**
 * Native QuickActions — mirror of apps/web/components/homepage/
 * quick-actions.tsx (2×2 card grid of primary destinations).
 */
import { router } from "expo-router";
import type { Href } from "expo-router";
import {
  Calculator,
  LayoutDashboard,
  PlusCircle,
  Settings,
} from "lucide-react-native";
import type { ComponentType } from "react";
import { Pressable, Text, View } from "react-native";

import { tokens } from "@handicappin/tokens/tokens";
import { useColorMode } from "@/lib/color-mode";
import { cn } from "@/lib/utils";

const ICON_SIZE = 24; // allow-hardcoded lucide icon prop mirrors web's fixed h-6 w-6 icon box

interface QuickActionsProps {
  userId: string;
  className?: string;
}

export function QuickActions({ userId, className }: QuickActionsProps) {
  const mode = useColorMode();

  const actions: {
    label: string;
    href: string;
    icon: ComponentType<{ size?: number; color?: string }>;
    primary?: boolean;
    testID: string;
  }[] = [
    {
      label: "Log Round",
      href: "/rounds/add",
      icon: PlusCircle,
      primary: true,
      testID: "quick-action-log-round",
    },
    {
      label: "Dashboard",
      href: `/dashboard/${userId}`,
      icon: LayoutDashboard,
      testID: "quick-action-dashboard",
    },
    {
      label: "Calculators",
      href: "/calculators",
      icon: Calculator,
      testID: "quick-action-calculators",
    },
    {
      label: "Profile",
      href: `/profile/${userId}`,
      icon: Settings,
      testID: "quick-action-profile",
    },
  ];

  return (
    <View className={cn("flex-row flex-wrap gap-sm", className)}>
      {actions.map((action) => (
        // Grid geometry on a plain View (the hero grid's proven pattern):
        // arbitrary basis-[45%] classes don't compile under react-native-css
        // and Pressable ignores style-prop flexBasis.
        <View
          key={action.href}
          style={{ flexBasis: "45%", flexGrow: 1 }}
        >
        <Pressable
          testID={action.testID}
          accessibilityRole="button"
          accessibilityLabel={action.label}
          // typed-routes-forward-cast: targets land across clusters
          onPress={() => router.push(action.href as Href)}
          className={cn(
            "flex-1 rounded-lg border bg-card p-md items-center justify-center gap-sm active:opacity-80",
            action.primary && "tint-primary",
          )}
        >
          <action.icon
            size={ICON_SIZE}
            color={
              action.primary
                ? tokens.colors[mode].primary
                : tokens.colors[mode]["muted-foreground"]
            }
          />
          <Text
            className={cn(
              "text-label-sm",
              action.primary ? "text-primary" : "text-foreground",
            )}
          >
            {action.label}
          </Text>
        </Pressable>
        </View>
      ))}
    </View>
  );
}
