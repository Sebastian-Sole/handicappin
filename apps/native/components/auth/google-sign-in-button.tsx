/**
 * Google sign-in button — VISUAL twin of
 * apps/web/components/auth/google-sign-in-button.tsx.
 *
 * The functional flow is deferred (implementation log: web uses
 * @react-oauth/google's auth-code flow + a server-side exchange bound to web
 * redirect URIs; native needs an iOS OAuth client that doesn't exist yet).
 * Pressing it explains that Google sign-in isn't available in this build —
 * a clearly-labelled dev limitation, never a silent failure.
 */
import { useState } from "react";
import Svg, { Path } from "react-native-svg";

import { Button } from "@/components/ui/button";
import { FormFeedback } from "@/components/ui/form-feedback";
import { Text, View } from "react-native";

interface GoogleSignInButtonProps {
  mode?: "login" | "signup";
  className?: string;
}

/** Google "G" logo — hex fills are Google's mandated brand colors
 * (branding guidelines), intentionally outside the design token contract,
 * mirroring the same exception web makes. */
function GoogleLogo() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24">
      <Path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4" // allow-hardcoded Google brand color (web twin carries the same exception)
      />
      <Path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853" // allow-hardcoded Google brand color
      />
      <Path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05" // allow-hardcoded Google brand color
      />
      <Path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335" // allow-hardcoded Google brand color
      />
    </Svg>
  );
}

export function GoogleSignInButton({
  mode = "login",
  className,
}: GoogleSignInButtonProps) {
  const [notice, setNotice] = useState<string | null>(null);

  const buttonText =
    mode === "signup" ? "Sign up with Google" : "Sign in with Google";

  return (
    <View className="gap-md">
      {notice ? (
        <FormFeedback
          type="info"
          message={notice}
          onClose={() => setNotice(null)}
        />
      ) : null}
      <Button
        variant="outline"
        className={className}
        accessibilityLabel={buttonText}
        onPress={() =>
          setNotice(
            "Google sign-in isn't available in this development build yet — use email and password.",
          )
        }
      >
        <View className="flex-row items-center gap-sm">
          <GoogleLogo />
          <Text className="text-label-sm text-foreground">{buttonText}</Text>
        </View>
      </Button>
    </View>
  );
}
