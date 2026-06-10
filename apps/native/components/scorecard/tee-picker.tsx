/**
 * Tee picker — native equivalent of web's tee Select. Adding/editing tees
 * is deferred to web (implementation log), mirroring web's TeeDialog spot.
 */
import { ChevronsUpDown } from "lucide-react-native";
import { useState } from "react";
import { FlatList, Modal, Pressable, Text, View } from "react-native";

import { Button } from "@/components/ui/button";
import { tokens } from "@handicappin/tokens/tokens";
import type { FetchedTee } from "@/lib/api/procedures/scorecard";
import { useColorMode } from "@/lib/color-mode";

const ICON_SIZE = 16; // allow-hardcoded lucide icon prop mirrors web's fixed h-4 w-4 icon box

interface TeePickerProps {
  tees: FetchedTee[];
  selectedLabel: string;
  onSelect: (tee: FetchedTee) => void;
  disabled?: boolean;
}

export function TeePicker({
  tees,
  selectedLabel,
  onSelect,
  disabled,
}: TeePickerProps) {
  const mode = useColorMode();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        testID="tee-picker-trigger"
        variant="outline"
        className="w-full"
        disabled={disabled || tees.length === 0}
        onPress={() => setOpen(true)}
      >
        <View className="flex-row items-center justify-between w-full">
          <Text className="text-label-sm text-foreground flex-1" numberOfLines={1}>
            {selectedLabel}
          </Text>
          <ChevronsUpDown
            size={ICON_SIZE}
            color={tokens.colors[mode]["muted-foreground"]}
          />
        </View>
      </Button>

      <Modal
        visible={open}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setOpen(false)}
      >
        <View className="flex-1 bg-background p-lg gap-md">
          <Text className="text-heading-4 text-foreground">Select tee</Text>
          <FlatList
            keyboardShouldPersistTaps="handled"
            data={tees}
            keyExtractor={(item) => `${item.name}_${item.gender}`}
            renderItem={({ item }) => (
              <Pressable
                accessibilityRole="button"
                className="py-md px-sm rounded-md active:opacity-70"
                onPress={() => {
                  onSelect(item);
                  setOpen(false);
                }}
              >
                <Text className="text-body text-foreground">
                  {item.name} ({item.gender}) — {item.totalPar} par,{" "}
                  {item.totalDistance} {item.distanceMeasurement}
                </Text>
              </Pressable>
            )}
          />
          <Button variant="outline" onPress={() => setOpen(false)}>
            Cancel
          </Button>
        </View>
      </Modal>
    </>
  );
}
