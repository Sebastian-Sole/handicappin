/**
 * Verify signup — native twin of apps/web/app/(auth)/verify-signup/page.tsx:
 * email + 6-digit OTP (3–3 with separator) against the verify-signup-otp
 * edge function, attempt countdown, resend with rate-limit cooldown, tip
 * alert. Success routes to /login?verified=true like web.
 */
import { Check, Loader2 } from "lucide-react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";

import { AuthFormShell } from "@/components/auth/auth-form-shell";
import { DataSettledMarker } from "@/components/data-settled";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputOTP } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { tokens } from "@handicappin/tokens/tokens";
import { useColorMode } from "@/lib/color-mode";
import { env } from "@/lib/env";

const REDIRECT_DELAY_MS = 2000;
const STATUS_RESET_DELAY_MS = 3000;
const ICON_SIZE = 16; // allow-hardcoded lucide icon prop mirrors web's h-4 w-4 icon box

type Status = "idle" | "loading" | "success" | "error";

export default function VerifySignupScreen() {
  const params = useLocalSearchParams<{ email?: string }>();
  const emailFromUrl = typeof params.email === "string" ? params.email : "";
  const mode = useColorMode();

  const [otp, setOtp] = useState("");
  const [email, setEmail] = useState(emailFromUrl);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(
    null,
  );
  const [resendCooldown, setResendCooldown] = useState(0);
  const redirectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const statusResetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  useEffect(() => {
    return () => {
      if (redirectTimeoutRef.current) clearTimeout(redirectTimeoutRef.current);
      if (statusResetTimeoutRef.current) {
        clearTimeout(statusResetTimeoutRef.current);
      }
    };
  }, []);

  // Native screens persist across deep links (unlike web's fresh page load),
  // so a later ?email= must update the field, not just the first mount.
  useEffect(() => {
    if (emailFromUrl) setEmail(emailFromUrl);
  }, [emailFromUrl]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const handleSubmit = useCallback(async () => {
    if (!email || otp.length !== 6) return;
    setStatus("loading");
    setMessage("");

    try {
      const response = await fetch(
        `${env.supabaseUrl}/functions/v1/verify-signup-otp`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, otp }),
        },
      );

      const data: unknown = await response.json();
      const record =
        typeof data === "object" && data !== null
          ? (data as Record<string, unknown>)
          : {};

      if (response.ok && record["success"] === true) {
        setStatus("success");
        setMessage(
          typeof record["message"] === "string"
            ? record["message"]
            : "Email verified successfully! Redirecting to login...",
        );
        redirectTimeoutRef.current = setTimeout(
          () => router.push("/login?verified=true"),
          REDIRECT_DELAY_MS,
        );
      } else {
        setStatus("error");
        setMessage(
          typeof record["error"] === "string"
            ? record["error"]
            : "Verification failed. Please check your code and try again.",
        );
        if (typeof record["remainingAttempts"] === "number") {
          setRemainingAttempts(record["remainingAttempts"]);
        }
        setOtp("");
        if (record["maxAttemptsReached"] === true) {
          setRemainingAttempts(0);
        }
      }
    } catch {
      setStatus("error");
      setMessage("An unexpected error occurred. Please try again.");
      setOtp("");
    }
  }, [email, otp]);

  const handleResend = useCallback(async () => {
    if (!email) {
      setStatus("error");
      setMessage("Please enter your email address");
      return;
    }
    setStatus("loading");

    try {
      const response = await fetch(
        `${env.supabaseUrl}/functions/v1/resend-verification-otp`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        },
      );

      const data: unknown = await response.json();
      const record =
        typeof data === "object" && data !== null
          ? (data as Record<string, unknown>)
          : {};

      if (response.ok && record["success"] === true) {
        setStatus("success");
        setMessage(
          typeof record["message"] === "string"
            ? record["message"]
            : "A new verification code has been sent to your email.",
        );
        setRemainingAttempts(null);
        setOtp("");
        statusResetTimeoutRef.current = setTimeout(
          () => setStatus("idle"),
          STATUS_RESET_DELAY_MS,
        );
      } else if (
        response.status === 429 &&
        typeof record["waitSeconds"] === "number"
      ) {
        setStatus("error");
        setMessage(
          typeof record["error"] === "string"
            ? record["error"]
            : "Please wait before requesting another code.",
        );
        setResendCooldown(record["waitSeconds"]);
      } else {
        setStatus("error");
        setMessage(
          typeof record["error"] === "string"
            ? record["error"]
            : "Failed to resend code. Please try again.",
        );
      }
    } catch {
      setStatus("error");
      setMessage("Failed to resend code. Please try again.");
    }
  }, [email]);

  const busy = status === "loading" || status === "success";

  return (
    <AuthFormShell
      testID="verify-signup-screen"
      title="Verify Your Email"
      description="Enter the 6-digit code we sent to your email"
    >
      <DataSettledMarker settled />
      <View className="gap-lg">
        <View className="gap-sm">
          <Label>Email Address</Label>
          <Input
            testID="verify-signup-email"
            placeholder="your@email.com"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            editable={!busy}
          />
        </View>

        <View className="gap-sm">
          <Label className="text-center">Verification Code</Label>
          <View className="items-center">
            <InputOTP
              testID="verify-signup-otp"
              accessibilityLabel="Enter 6-digit verification code"
              value={otp}
              onChange={setOtp}
              disabled={busy}
              separator
            />
          </View>
          <Text className="text-meta text-muted-foreground text-center mt-xs">
            Check your spam folder if you don&apos;t see the email
          </Text>
        </View>

        {message ? (
          <Alert variant={status === "error" ? "destructive" : "default"}>
            <AlertDescription
              className={status === "error" ? "text-destructive" : undefined}
            >
              {message}
              {remainingAttempts !== null &&
              remainingAttempts > 0 &&
              status === "error"
                ? `\n${remainingAttempts} ${
                    remainingAttempts === 1 ? "attempt" : "attempts"
                  } remaining`
                : ""}
            </AlertDescription>
          </Alert>
        ) : null}

        <Button
          testID="verify-signup-submit"
          className="w-full"
          disabled={busy || otp.length !== 6}
          accessibilityLabel={
            status === "loading"
              ? "Verifying email, please wait"
              : status === "success"
                ? "Email verified successfully"
                : "Verify email"
          }
          onPress={() => {
            void handleSubmit();
          }}
        >
          <View className="flex-row items-center gap-sm">
            {status === "loading" ? (
              <Loader2
                size={ICON_SIZE}
                color={tokens.colors[mode]["primary-foreground"]}
              />
            ) : null}
            {status === "success" ? (
              <Check
                size={ICON_SIZE}
                color={tokens.colors[mode]["primary-foreground"]}
              />
            ) : null}
            <Text className="text-label-sm text-primary-foreground">
              Verify Email
            </Text>
          </View>
        </Button>

        <View className="items-center">
          <Button
            variant="link"
            disabled={busy || resendCooldown > 0}
            accessibilityLabel={
              resendCooldown > 0
                ? `Wait ${resendCooldown} seconds before requesting another code`
                : "Resend verification code"
            }
            onPress={() => {
              void handleResend();
            }}
          >
            {resendCooldown > 0
              ? `Wait ${resendCooldown}s to resend`
              : "Didn't receive a code? Resend"}
          </Button>
        </View>

        <Alert>
          <AlertDescription className="text-meta">
            <Text className="text-meta font-semibold text-foreground">
              Tip:
            </Text>{" "}
            Check your spam folder if you don&apos;t see the email. The code
            expires in 15 minutes.
          </AlertDescription>
        </Alert>
      </View>
    </AuthFormShell>
  );
}
