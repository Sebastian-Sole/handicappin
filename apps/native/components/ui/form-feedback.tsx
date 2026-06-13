/**
 * Native FormFeedback — mirror of apps/web/components/ui/form-feedback.tsx
 * (same tint-* container recipes, same icon set via lucide).
 */
import { AlertCircle, CheckCircle, CircleAlert, X } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";

import { tokens } from "@handicappin/tokens/tokens";
import { cn } from "@/lib/utils";
import { useColorMode } from "@/lib/color-mode";

interface FormFeedbackProps {
  type: "success" | "error" | "info";
  title?: string;
  message: string;
  className?: string;
  onClose?: () => void;
}

const ICON_SIZE = 16; // allow-hardcoded lucide icon prop mirrors web's fixed h-4 w-4 icon box

export function FormFeedback({
  type,
  title,
  message,
  className,
  onClose,
}: FormFeedbackProps) {
  const mode = useColorMode();
  const iconColor = {
    success: tokens.colors[mode].success,
    error: tokens.colors[mode].destructive,
    info: tokens.colors[mode].info,
  }[type];

  const Icon = {
    success: CheckCircle,
    error: CircleAlert,
    info: AlertCircle,
  }[type];

  const containerStyles = {
    success: "tint-success",
    error: "tint-destructive",
    info: "tint-info",
  }[type];

  const textStyles = {
    success: "text-success",
    error: "text-destructive",
    info: "text-info",
  }[type];

  return (
    <View
      accessibilityRole="alert"
      className={cn("w-full rounded-lg border p-md", containerStyles, className)}
    >
      <View className="flex-row items-center gap-md">
        <Icon size={ICON_SIZE} color={iconColor} />
        <View className="flex-1">
          {title ? (
            <Text className={cn("text-body-sm mb-xs font-semibold", textStyles)}>
              {title}
            </Text>
          ) : null}
          <Text className={cn("text-body-sm", textStyles)}>{message}</Text>
        </View>
        {onClose ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={onClose}
            className="rounded-sm opacity-70 active:opacity-100"
          >
            <X size={ICON_SIZE} color={iconColor} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
