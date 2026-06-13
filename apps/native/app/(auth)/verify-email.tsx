/**
 * Verify email — native twin of apps/web/app/(auth)/verify-email/page.tsx.
 * Web is a server page that exchanges the emailed ?code= for a session,
 * marks the profile verified, and bounces to /login?verified=true. Native
 * is the deep-link landing for the same links (handicappin://verify-email
 * ?code=…): same exchange, same outcomes, with a visible verifying state
 * (ported for structure; the email loop itself is out of scope per §7b).
 */
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";

import { AuthFormShell } from "@/components/auth/auth-form-shell";
import { DataSettledMarker } from "@/components/data-settled";
import { Button } from "@/components/ui/button";
import { H1 } from "@/components/ui/typography";
import { supabase } from "@/lib/supabase";

type State = "verifying" | "failed";

export default function VerifyEmailScreen() {
  const params = useLocalSearchParams<{ code?: string }>();
  const code = typeof params.code === "string" ? params.code : null;
  const [state, setState] = useState<State>("verifying");
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    if (!code) {
      router.replace("/login");
      return;
    }

    void (async () => {
      try {
        const { data, error } = await supabase.auth.exchangeCodeForSession(
          code,
        );
        if (error || !data.user) {
          setState("failed");
          return;
        }

        const { error: updateProfileError } = await supabase
          .from("profile")
          .update({ verified: true })
          .eq("id", data.user.id);

        if (updateProfileError) {
          router.replace("/login");
          return;
        }

        router.replace("/login?verified=true");
      } catch {
        setState("failed");
      }
    })();
  }, [code]);

  return (
    <AuthFormShell testID="verify-email-screen">
      <DataSettledMarker settled={state === "failed"} />
      <View className="items-center gap-md">
        {state === "verifying" ? (
          <>
            <H1 className="text-center">Verifying Email</H1>
            <Text className="text-body text-muted-foreground text-center">
              Please wait while we confirm your email address...
            </Text>
          </>
        ) : (
          <>
            <H1 className="text-center">Verification Failed</H1>
            <Text className="text-body text-muted-foreground text-center">
              Failed to verify email, try again
            </Text>
            <Button
              className="w-full"
              onPress={() => router.replace("/login")}
            >
              Back to Login
            </Button>
          </>
        )}
      </View>
    </AuthFormShell>
  );
}
