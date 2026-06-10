/** Native Badge — mirror of apps/web/components/ui/badge.tsx. */
import { cva, type VariantProps } from "class-variance-authority";
import type { ReactNode } from "react";
import { Text, View } from "react-native";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "flex-row items-center rounded-full border px-sm py-xs self-start",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary",
        secondary: "border-transparent bg-secondary",
        destructive: "border-transparent bg-destructive",
        outline: "bg-transparent",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

const badgeTextVariants = cva("text-badge", {
  variants: {
    variant: {
      default: "text-primary-foreground",
      secondary: "text-secondary-foreground",
      destructive: "text-destructive-foreground",
      outline: "text-foreground",
    },
  },
  defaultVariants: { variant: "default" },
});

export interface BadgeProps extends VariantProps<typeof badgeVariants> {
  children: ReactNode;
  className?: string;
  textClassName?: string;
}

export function Badge({
  children,
  className,
  textClassName,
  variant,
}: BadgeProps) {
  return (
    <View className={cn(badgeVariants({ variant }), className)}>
      {typeof children === "string" ? (
        <Text className={cn(badgeTextVariants({ variant }), textClassName)}>
          {children}
        </Text>
      ) : (
        children
      )}
    </View>
  );
}
