/**
 * Native AddTeeModal — mirror of apps/web/components/scorecard/
 * tee-dialog.tsx in "add" mode: TeeFormSection + a save gated on the tee
 * schema; the saved tee goes up as approvalStatus "pending" with no ids
 * (the server creates it alongside the round). Edit mode stays web-only
 * (deferred, logged).
 */
import { useEffect, useState } from "react";
import { Modal, ScrollView, Text, View } from "react-native";

import type { Tee } from "@handicappin/handicap-core";
import { tokens } from "@handicappin/tokens/tokens";

import { TeeFormSection } from "@/components/scorecard/tee-form-section";
import { Button } from "@/components/ui/button";
import { blankTee, isTeeValid } from "@/lib/scorecard-form";

interface AddTeeModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (tee: Tee) => void;
}

export function AddTeeModal({ open, onClose, onSave }: AddTeeModalProps) {
  const [tee, setTee] = useState<Tee>(blankTee);

  useEffect(() => {
    if (open) setTee(blankTee());
  }, [open]);

  return (
    <Modal
      visible={open}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-background" testID="add-tee-modal">
        <View className="p-lg pb-md border-b border-border">
          <Text className="text-heading-4 text-foreground">Add New Tee</Text>
        </View>
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: tokens.spacing.lg }}
          keyboardShouldPersistTaps="handled"
        >
          <TeeFormSection tee={tee} onTeeChange={setTee} />
        </ScrollView>
        <View className="p-lg pt-md border-t border-border flex-row gap-sm">
          <Button variant="outline" className="flex-1" onPress={onClose}>
            Cancel
          </Button>
          <Button
            testID="save-tee"
            className="flex-1"
            disabled={!isTeeValid(tee)}
            onPress={() => {
              onSave({ ...tee, approvalStatus: "pending" });
              onClose();
            }}
          >
            Add Tee
          </Button>
        </View>
      </View>
    </Modal>
  );
}
