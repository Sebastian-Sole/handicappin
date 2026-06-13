/** Native typography — mirror of apps/web/components/ui/typography.tsx. */
import type { ReactNode } from "react";
import { Text } from "react-native";

import { cn } from "@/lib/utils";

type TypographyProps = {
  children: ReactNode;
  className?: string;
};

export function H1({ children, className }: TypographyProps) {
  return (
    <Text
      accessibilityRole="header"
      className={cn("text-heading-1 text-foreground", className)}
    >
      {children}
    </Text>
  );
}

export function H2({ children, className }: TypographyProps) {
  return (
    <Text
      accessibilityRole="header"
      className={cn("text-heading-2 pb-sm text-foreground", className)}
    >
      {children}
    </Text>
  );
}

export function H3({ children, className }: TypographyProps) {
  return (
    <Text
      accessibilityRole="header"
      className={cn("text-heading-3 text-foreground", className)}
    >
      {children}
    </Text>
  );
}

export function H4({ children, className }: TypographyProps) {
  return (
    <Text
      accessibilityRole="header"
      className={cn("text-heading-4 text-foreground", className)}
    >
      {children}
    </Text>
  );
}

export function P({ children, className }: TypographyProps) {
  return (
    <Text className={cn("text-body text-foreground", className)}>
      {children}
    </Text>
  );
}
