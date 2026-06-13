/**
 * Native OTP input — mirror of apps/web/components/ui/input-otp.tsx (six
 * 40px joined boxes, first/last rounded, active ring). One invisible
 * TextInput owns the value (the standard RN pattern); the boxes are a
 * visual projection, so paste/autofill/keyboard all behave natively.
 */
import { useRef, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import { cn } from "@/lib/utils";

export interface InputOTPProps {
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
  disabled?: boolean;
  testID?: string;
  accessibilityLabel?: string;
  /** Render two joined groups with a dash between (web verify-signup style). */
  separator?: boolean;
}

export function InputOTP({
  value,
  onChange,
  maxLength = 6,
  disabled = false,
  testID,
  accessibilityLabel,
  separator = false,
}: InputOTPProps) {
  const inputRef = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);
  const chars = value.split("");
  const activeIndex = Math.min(value.length, maxLength - 1);
  const groupBreak = separator ? Math.ceil(maxLength / 2) : maxLength;

  const renderSlot = (index: number, isLastInGroup: boolean) => {
    const isActive = focused && index === activeIndex;
    return (
      <View
        key={index}
        className={cn(
          "h-10 w-10 items-center justify-center",
          !isLastInGroup && "border-r border-input",
          isActive && "border-2 border-ring rounded-sm",
        )}
      >
        <Text className="text-body-sm text-foreground">
          {chars[index] ?? ""}
        </Text>
      </View>
    );
  };

  // One bordered rounded strip per group + per-slot right separators:
  // per-side border-y/-l/-r utilities don't materialize reliably under
  // react-native-css, and this draws the same joined-box look as web.
  const groupClass =
    "flex-row items-center rounded-md border border-input bg-background overflow-hidden";

  return (
    <Pressable
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      onPress={() => inputRef.current?.focus()}
      disabled={disabled}
      className={cn("flex-row items-center gap-sm", disabled && "opacity-50")}
    >
      <View className={groupClass}>
        {Array.from({ length: groupBreak }, (_, i) =>
          renderSlot(i, i === groupBreak - 1),
        )}
      </View>
      {separator ? (
        <Text className="text-body text-muted-foreground">-</Text>
      ) : null}
      {separator ? (
        <View className={groupClass}>
          {Array.from({ length: maxLength - groupBreak }, (_, i) =>
            renderSlot(groupBreak + i, groupBreak + i === maxLength - 1),
          )}
        </View>
      ) : null}
      {/* Invisible input that owns the value (testID lives on the visible
          Pressable — invisible nodes aren't tappable for Maestro). */}
      <TextInput
        ref={inputRef}
        value={value}
        editable={!disabled}
        onChangeText={(next) =>
          onChange(next.replace(/\D/g, "").slice(0, maxLength))
        }
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        maxLength={maxLength}
        style={{ position: "absolute", opacity: 0, width: 1, height: 1 }}
      />
    </Pressable>
  );
}
