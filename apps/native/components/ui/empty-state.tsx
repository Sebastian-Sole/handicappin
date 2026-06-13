/** Native EmptyState — mirror of apps/web/components/ui/empty-state.tsx. */
import type { ReactNode } from "react";
import { Text, View } from "react-native";

import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  size?: "default" | "compact";
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  size = "default",
  className,
}: EmptyStateProps) {
  const compact = size === "compact";
  return (
    <View
      className={cn(
        "items-center justify-center",
        compact ? "py-md" : "py-xl",
        className,
      )}
    >
      {icon ? (
        <View
          className={cn(
            "icon-chip bg-muted",
            compact ? "mb-xs" : "mb-md",
          )}
        >
          {icon}
        </View>
      ) : null}
      <Text
        className={cn(
          "text-center",
          compact
            ? "text-meta-strong text-foreground"
            : "text-heading-5 text-foreground",
        )}
      >
        {title}
      </Text>
      {description ? (
        <Text className="text-body-sm text-muted-foreground mt-xs text-center">
          {description}
        </Text>
      ) : null}
      {action ? <View className="mt-md">{action}</View> : null}
    </View>
  );
}
