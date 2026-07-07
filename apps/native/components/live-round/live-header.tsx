/**
 * Live round header: course context + running score, leave (session keeps
 * running; resume from Home) and abandon (confirmed discard).
 */
import { ChevronDown, Trash2 } from "lucide-react-native";
import { Alert, Pressable, Text, View } from "react-native";

import { tokens } from "@handicappin/tokens/tokens";

import { formatVsPar } from "@/components/live-round/score-colors";
import { useColorMode } from "@/lib/color-mode";
import { cn } from "@/lib/utils";

interface LiveHeaderProps {
  courseName: string;
  scored: number;
  holeCount: number;
  totalStrokes: number;
  vsPar: number;
  /** Close the modal, session stays active (resume card on Home). */
  onLeave: () => void;
  /** Discard the round entirely (already confirmed). */
  onAbandon: () => void;
}

const HEADER_ICON_SIZE = 20; // allow-hardcoded lucide icon prop inside the 40px header buttons

export function LiveHeader({
  courseName,
  scored,
  holeCount,
  totalStrokes,
  vsPar,
  onLeave,
  onAbandon,
}: LiveHeaderProps) {
  const mode = useColorMode();
  const mutedForeground = tokens.colors[mode]["muted-foreground"];
  const destructive = tokens.colors[mode].destructive;

  const confirmAbandon = () => {
    Alert.alert(
      "Discard this round?",
      "All scores from this round will be lost.",
      [
        { text: "Keep playing", style: "cancel" },
        { text: "Discard", style: "destructive", onPress: onAbandon },
      ],
    );
  };

  return (
    <View className="flex-row items-center gap-sm px-md">
      <Pressable
        testID="live-leave"
        accessibilityRole="button"
        accessibilityLabel="Minimize round, keep playing later"
        onPress={onLeave}
        className="h-10 w-10 items-center justify-center rounded-full bg-muted active:opacity-80"
      >
        <ChevronDown size={HEADER_ICON_SIZE} color={mutedForeground} />
      </Pressable>
      <View className="flex-1">
        <Text className="text-label-sm text-foreground" numberOfLines={1}>
          {courseName}
        </Text>
        <Text className="text-body-sm text-muted-foreground">
          {scored}/{holeCount} holes · {totalStrokes} strokes
        </Text>
      </View>
      <View
        testID="live-vspar-chip"
        className={cn(
          "rounded-full px-md py-xs",
          vsPar < 0
            ? "chip-success"
            : vsPar === 0
              ? "chip-primary"
              : "bg-muted",
        )}
      >
        <Text
          className={cn(
            "text-figure-sm",
            vsPar < 0
              ? "text-success"
              : vsPar === 0
                ? "text-primary"
                : "text-foreground",
          )}
        >
          {formatVsPar(vsPar)}
        </Text>
      </View>
      <Pressable
        testID="live-abandon"
        accessibilityRole="button"
        accessibilityLabel="Discard round"
        onPress={confirmAbandon}
        className="h-10 w-10 items-center justify-center rounded-full bg-muted active:opacity-80"
      >
        <Trash2 size={HEADER_ICON_SIZE} color={destructive} />
      </Pressable>
    </View>
  );
}
