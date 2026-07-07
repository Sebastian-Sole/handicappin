/** Stepper modal for outlier scores the quick-pick grid doesn't cover. */
import { Minus, Plus } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";

import { tokens } from "@handicappin/tokens/tokens";

import { Button } from "@/components/ui/button";
import { MAX_STROKES, MIN_STROKES } from "@/lib/round-session/engine";
import { useColorMode } from "@/lib/color-mode";

interface ScoreStepperProps {
  visible: boolean;
  par: number;
  /** Current strokes for the hole; stepper opens on this (or par). */
  initial: number | null;
  onCommit: (strokes: number) => void;
  onClose: () => void;
}

const STEPPER_ICON_SIZE = 28; // allow-hardcoded lucide icon prop inside the 56px stepper buttons

export function ScoreStepper({
  visible,
  par,
  initial,
  onCommit,
  onClose,
}: ScoreStepperProps) {
  const mode = useColorMode();
  const foreground = tokens.colors[mode].foreground;
  const [value, setValue] = useState(initial ?? par);

  // Re-seed whenever the modal opens for a (possibly different) hole.
  useEffect(() => {
    if (visible) setValue(initial ?? par);
  }, [visible, initial, par]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        className="flex-1 items-center justify-center bg-overlay"
        onPress={onClose}
      >
        <Pressable
          className="w-4/5 rounded-lg bg-card border border-border p-lg gap-lg"
          // Swallow taps so the backdrop press doesn't dismiss.
          onPress={() => {}}
        >
          <Text className="text-heading-4 text-foreground text-center">
            Enter score
          </Text>
          <View className="flex-row items-center justify-center gap-lg">
            <Pressable
              testID="live-stepper-minus"
              accessibilityRole="button"
              accessibilityLabel="One stroke less"
              disabled={value <= MIN_STROKES}
              onPress={() => setValue((v) => Math.max(MIN_STROKES, v - 1))}
              className="h-14 w-14 items-center justify-center rounded-full border border-border bg-background active:opacity-80 disabled:opacity-40"
            >
              <Minus size={STEPPER_ICON_SIZE} color={foreground} />
            </Pressable>
            <Text
              testID="live-stepper-value"
              className="text-display text-foreground min-w-20 text-center"
            >
              {value}
            </Text>
            <Pressable
              testID="live-stepper-plus"
              accessibilityRole="button"
              accessibilityLabel="One stroke more"
              disabled={value >= MAX_STROKES}
              onPress={() => setValue((v) => Math.min(MAX_STROKES, v + 1))}
              className="h-14 w-14 items-center justify-center rounded-full border border-border bg-background active:opacity-80 disabled:opacity-40"
            >
              <Plus size={STEPPER_ICON_SIZE} color={foreground} />
            </Pressable>
          </View>
          <View className="flex-row gap-sm">
            <Button variant="outline" className="flex-1" onPress={onClose}>
              Cancel
            </Button>
            <Button
              testID="live-stepper-save"
              className="flex-1"
              onPress={() => {
                onCommit(value);
                onClose();
              }}
            >
              Save
            </Button>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
