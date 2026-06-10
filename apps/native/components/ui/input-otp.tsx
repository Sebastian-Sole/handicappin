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
}

export function InputOTP({
  value,
  onChange,
  maxLength = 6,
  disabled = false,
  testID,
  accessibilityLabel,
}: InputOTPProps) {
  const inputRef = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);
  const chars = value.split("");
  const activeIndex = Math.min(value.length, maxLength - 1);

  return (
    <Pressable
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      onPress={() => inputRef.current?.focus()}
      disabled={disabled}
      // One bordered rounded strip + per-slot right separators: per-side
      // border-y/-l/-r utilities don't materialize reliably under
      // react-native-css, and this draws the same joined-box look.
      className={cn(
        "flex-row items-center rounded-md border border-input bg-background overflow-hidden",
        disabled && "opacity-50",
      )}
    >
      {Array.from({ length: maxLength }, (_, index) => {
        const isActive = focused && index === activeIndex;
        return (
          <View
            key={index}
            className={cn(
              "h-10 w-10 items-center justify-center",
              index < maxLength - 1 && "border-r border-input",
              isActive && "border-2 border-ring rounded-sm",
            )}
          >
            <Text className="text-body-sm text-foreground">
              {chars[index] ?? ""}
            </Text>
          </View>
        );
      })}
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
