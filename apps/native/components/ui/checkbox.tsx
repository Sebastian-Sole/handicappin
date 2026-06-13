/**
 * Native Checkbox — mirror of apps/web/components/ui/checkbox.tsx (Radix):
 * 16px rounded-sm box, primary border, primary fill + primary-foreground
 * check when checked.
 */
import { Check } from "lucide-react-native";
import { Pressable } from "react-native";

import { tokens } from "@handicappin/tokens/tokens";
import { useColorMode } from "@/lib/color-mode";
import { cn } from "@/lib/utils";

const CHECK_SIZE = 12; // allow-hardcoded lucide icon prop mirrors web's h-4 w-4 box minus padding

export interface CheckboxProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  className?: string;
  testID?: string;
  accessibilityLabel?: string;
}

export function Checkbox({
  checked,
  onCheckedChange,
  className,
  testID,
  accessibilityLabel,
}: CheckboxProps) {
  const mode = useColorMode();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={accessibilityLabel}
      onPress={() => onCheckedChange(!checked)}
      hitSlop={8}
      className={cn(
        "h-4 w-4 items-center justify-center rounded-sm border border-primary",
        checked && "bg-primary",
        className,
      )}
    >
      {checked ? (
        <Check
          size={CHECK_SIZE}
          color={tokens.colors[mode]["primary-foreground"]}
          strokeWidth={3}
        />
      ) : null}
    </Pressable>
  );
}
