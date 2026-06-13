/** Native Alert — mirror of apps/web/components/ui/alert.tsx. */
import type { ReactNode } from "react";
import { Text, View } from "react-native";

import { cn } from "@/lib/utils";

export function Alert({
  children,
  className,
  variant = "default",
}: {
  children: ReactNode;
  className?: string;
  variant?: "default" | "destructive";
}) {
  return (
    <View
      accessibilityRole="summary"
      className={cn(
        "w-full rounded-lg border p-md",
        variant === "default" && "bg-background",
        variant === "destructive" && "tint-destructive",
        className,
      )}
    >
      {children}
    </View>
  );
}

export function AlertTitle({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <Text className={cn("text-body font-medium text-foreground", className)}>
      {children}
    </Text>
  );
}

export function AlertDescription({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <Text className={cn("text-body-sm text-foreground", className)}>
      {children}
    </Text>
  );
}
