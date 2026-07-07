/**
 * The center-(+) action sheet: "Play live round" (flagship) or "Enter
 * scorecard" (the classic batch form). Plain RN Modal styled as a bottom
 * sheet — consistent across iOS/Android and no new route/deps.
 */
import { router } from "expo-router";
import { ClipboardList, Flag } from "lucide-react-native";
import { Modal, Pressable, Text, View } from "react-native";
import Animated, { SlideInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { tokens } from "@handicappin/tokens/tokens";

import { useColorMode } from "@/lib/color-mode";

interface StartRoundSheetProps {
  visible: boolean;
  onClose: () => void;
}

const SHEET_ICON_SIZE = 24; // allow-hardcoded lucide icon prop inside the 48px option chips

export function StartRoundSheet({ visible, onClose }: StartRoundSheetProps) {
  const mode = useColorMode();
  const insets = useSafeAreaInsets();
  const colors = tokens.colors[mode];

  const go = (href: "/rounds/live/setup" | "/rounds/add") => {
    onClose();
    router.push(href);
  };

  return (
    // animationType="fade" so the dark overlay EASES IN over the tab bar
    // (with "slide" the backdrop itself visibly drags up from the bottom);
    // the sheet card then slides up independently via the entering
    // animation below.
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        className="flex-1 justify-end bg-overlay"
        accessibilityLabel="Close"
        onPress={onClose}
      >
        <Animated.View entering={SlideInDown.duration(280)}>
          <Pressable
            className="rounded-t-lg bg-card border border-border p-md gap-sm"
            style={{ paddingBottom: insets.bottom + tokens.spacing.md }}
            onPress={() => {}}
          >
          <Text className="text-heading-5 text-foreground px-sm py-xs">
            Log a round
          </Text>
          <Pressable
            testID="start-live-round"
            accessibilityRole="button"
            accessibilityLabel="Play live round, score hole by hole"
            onPress={() => go("/rounds/live/setup")}
            className="flex-row items-center gap-md rounded-lg bg-primary p-md active:opacity-90"
          >
            <View className="h-12 w-12 items-center justify-center">
              <Flag size={SHEET_ICON_SIZE} color={colors["primary-foreground"]} />
            </View>
            <View className="flex-1">
              <Text className="text-label-sm text-primary-foreground">
                Play live round
              </Text>
              <Text className="text-body-sm text-primary-foreground opacity-80">
                Score hole by hole as you play
              </Text>
            </View>
          </Pressable>
          <Pressable
            testID="start-scorecard-entry"
            accessibilityRole="button"
            accessibilityLabel="Enter scorecard for a finished round"
            onPress={() => go("/rounds/add")}
            className="flex-row items-center gap-md rounded-lg border border-border bg-background p-md active:opacity-80"
          >
            <View className="h-12 w-12 items-center justify-center rounded-full bg-muted">
              <ClipboardList
                size={SHEET_ICON_SIZE}
                color={colors["muted-foreground"]}
              />
            </View>
            <View className="flex-1">
              <Text className="text-label-sm text-foreground">
                Enter scorecard
              </Text>
              <Text className="text-body-sm text-muted-foreground">
                Type in a round you already played
              </Text>
            </View>
          </Pressable>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}
