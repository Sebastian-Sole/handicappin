/** Native Card — mirror of apps/web/components/ui/card.tsx. */
import type { ReactNode } from "react";
import { View } from "react-native";

import { cn } from "@/lib/utils";

export function Card({
  children,
  className,
  testID,
}: {
  children: ReactNode;
  className?: string;
  testID?: string;
}) {
  return (
    <View
      testID={testID}
      className={cn("rounded-lg border bg-card", className)}
    >
      {children}
    </View>
  );
}

export function CardHeader({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <View className={cn("gap-xs p-lg", className)}>{children}</View>;
}

export function CardContent({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <View className={cn("p-lg pt-0", className)}>{children}</View>;
}

export function CardFooter({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <View className={cn("flex-row items-center p-lg pt-0", className)}>
      {children}
    </View>
  );
}
