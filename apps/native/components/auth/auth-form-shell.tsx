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

import { tokens } from "@handicappin/tokens/tokens";

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
        // ALL container styling lives in this one style object: passing
        // contentContainerClassName AND contentContainerStyle together makes
        // the inline style clobber the className-derived padding (observed
        // on-sim: px-lg vanished, content ran to the screen edge). Values
        // come from tokens; safe-area insets are runtime-only.
        // No items-center/max-w-sm: web's max-w-sm (384px) never binds inside
        // phone-width padding, and centering a %-width child against a
        // content-sized container collapses to 0 width under Yoga.
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: "center",
          paddingHorizontal: tokens.spacing.lg,
          paddingTop: insets.top + tokens.spacing.md,
          paddingBottom: insets.bottom + tokens.spacing.md,
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
