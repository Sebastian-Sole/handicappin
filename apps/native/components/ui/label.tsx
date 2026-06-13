/** Native Label — mirror of apps/web/components/ui/label.tsx. */
import type { ReactNode } from "react";
import { Text } from "react-native";

import { cn } from "@/lib/utils";

export function Label({
  children,
  className,
  nativeID,
}: {
  children: ReactNode;
  className?: string;
  nativeID?: string;
}) {
  return (
    <Text nativeID={nativeID} className={cn("text-label-sm text-foreground", className)}>
      {children}
    </Text>
  );
}
