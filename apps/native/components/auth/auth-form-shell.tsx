/**
 * Native AuthFormShell — mirror of apps/web/components/auth/auth-form-shell.tsx:
 * a narrow centered column on a flex-centered canvas shared by every auth/
 * recovery surface. Wrapped in KeyboardAvoiding + scroll so forms stay
 * reachable with the keyboard up (native-only concern; visual hierarchy
 * matches web).
 */
import type { ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { H1 } from "@/components/ui/typography";
import { cn } from "@/lib/utils";

interface AuthFormShellProps {
  children: ReactNode;
  className?: string;
  title?: string;
  description?: string;
  /** Test/capture id of the screen root (one per ported screen). */
  testID?: string;
}

export function AuthFormShell({
  children,
  className,
  title,
  description,
  testID,
}: AuthFormShellProps) {
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1 bg-background"
    >
      <ScrollView
        testID={testID}
        className="flex-1"
        // No items-center/max-w-sm: web's max-w-sm (384px) never binds inside
        // phone-width padding, and centering a %-width child against a
        // content-sized container collapses to 0 width under Yoga. Default
        // cross-axis stretch + px-lg padding = web's mobile layout.
        contentContainerClassName="flex-grow justify-center px-lg py-md"
        contentContainerStyle={{
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View className={cn("w-full gap-lg", className)}>
          {title || description ? (
            <View className="gap-sm items-center">
              {title ? <H1 className="text-center">{title}</H1> : null}
              {description ? (
                <Text className="text-body text-muted-foreground text-center">
                  {description}
                </Text>
              ) : null}
            </View>
          ) : null}
          {children}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
