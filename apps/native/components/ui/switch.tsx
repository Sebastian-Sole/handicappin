/**
 * Native Switch — mirror of apps/web/components/ui/switch.tsx (Radix):
 * pill track (primary when checked, input color when not) with a
 * background-colored thumb. Wraps React Native's Switch with token colors.
 */
import { Switch as RNSwitch } from "react-native";

import { tokens } from "@handicappin/tokens/tokens";
import { useColorMode } from "@/lib/color-mode";

export interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  testID?: string;
  accessibilityLabel?: string;
}

export function Switch({
  checked,
  onCheckedChange,
  disabled,
  testID,
  accessibilityLabel,
}: SwitchProps) {
  const mode = useColorMode();
  const colors = tokens.colors[mode];
  return (
    <RNSwitch
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      value={checked}
      onValueChange={onCheckedChange}
      disabled={disabled}
      trackColor={{ false: colors.input, true: colors.primary }}
      thumbColor={colors.background}
      ios_backgroundColor={colors.input}
    />
  );
}
