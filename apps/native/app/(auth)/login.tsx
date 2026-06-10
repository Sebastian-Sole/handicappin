/**
 * Login — native twin of apps/web/app/(auth)/login/page.tsx +
 * components/auth/login.tsx. Same flow: email/password sign-in, unverified
 * emails bounce to /verify-signup, billing claims route to /onboarding vs
 * home. Web's server-side redirect-if-authed becomes a mount-time check
 * (skipped mid-submit so the post-login navigation owns the transition).
 */
import { zodResolver } from "@hookform/resolvers/zod";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import type { Href } from "expo-router";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { Text, View } from "react-native";
import { z } from "zod";

import { AuthFormShell } from "@/components/auth/auth-form-shell";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { VerificationBox } from "@/components/auth/verification-box";
import { DataSettledMarker } from "@/components/data-settled";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { FormFeedback } from "@/components/ui/form-feedback";
import { Input } from "@/components/ui/input";
import { getBillingFromJWT } from "@/lib/auth/jwt";
import { useSession } from "@/lib/auth/session-provider";
import { supabase } from "@/lib/supabase";

interface FeedbackState {
  type: "success" | "error" | "info";
  message: string;
}

const loginSchema = z.object({
  email: z.string().min(2).max(50),
  password: z.string().min(6).max(50),
});

export default function LoginScreen() {
  const { session, initializing } = useSession();
  const params = useLocalSearchParams<{ verified?: string; error?: string }>();
  const isVerified = params.verified != null;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [buttonError, setButtonError] = useState(false);
  const buttonErrorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  // Once a submit starts, the screen owns navigation — suppress the
  // redirect-if-authed that would otherwise race it when the session lands.
  const hasSubmittedRef = useRef(false);

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  if (initializing) return null;
  if (session && !hasSubmittedRef.current) return <Redirect href="/" />;

  const showButtonError = () => {
    setButtonError(true);
    if (buttonErrorTimeoutRef.current) {
      clearTimeout(buttonErrorTimeoutRef.current);
    }
    buttonErrorTimeoutRef.current = setTimeout(() => {
      setButtonError(false);
    }, 2000);
  };

  const onSubmit = async (values: z.infer<typeof loginSchema>) => {
    hasSubmittedRef.current = true;
    setIsSubmitting(true);
    setFeedback(null);
    setButtonError(false);

    const { error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    });

    if (error) {
      const isEmailNotConfirmed =
        error.message.toLowerCase().includes("email not confirmed") ||
        error.code === "email_not_confirmed";

      if (isEmailNotConfirmed) {
        setFeedback({
          type: "info",
          message:
            "Please verify your email before signing in. Redirecting to verification...",
        });
        setTimeout(() => {
          router.push(
            `/verify-signup?email=${encodeURIComponent(values.email)}`,
          );
        }, 1500);
        setIsSubmitting(false);
        return;
      }

      const isInvalidCredentials =
        error.message.toLowerCase().includes("invalid login credentials") ||
        error.code === "invalid_credentials";

      if (isInvalidCredentials) {
        setFeedback({
          type: "error",
          message: "Invalid email or password. Please try again.",
        });
        showButtonError();
        setIsSubmitting(false);
        return;
      }

      setFeedback({ type: "error", message: error.message });
      setIsSubmitting(false);
      return;
    }

    const {
      data: { session: freshSession },
    } = await supabase.auth.getSession();
    const billing = getBillingFromJWT(freshSession);

    if (!billing?.plan) {
      // typed-routes-forward-cast: target screen lands later this cluster
      router.replace("/onboarding" as Href);
    } else {
      router.replace("/");
    }
  };

  return (
    <AuthFormShell
      testID="login-screen"
      title="Welcome Back"
      description="Sign in to your account to continue"
    >
      <DataSettledMarker settled />
      {isVerified ? <VerificationBox /> : null}
      {feedback ? (
        <FormFeedback
          type={feedback.type}
          message={feedback.message}
          onClose={() => setFeedback(null)}
        />
      ) : null}
      <View className="gap-md">
        <Form {...form}>
          <View className="gap-xl">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <Input
                    testID="login-email"
                    autoCapitalize="none"
                    autoComplete="email"
                    keyboardType="email-address"
                    value={field.value}
                    onChangeText={field.onChange}
                    onBlur={field.onBlur}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <Input
                    testID="login-password"
                    secureTextEntry
                    autoComplete="current-password"
                    value={field.value}
                    onChangeText={field.onChange}
                    onBlur={field.onBlur}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              testID="login-submit"
              className={buttonError ? "w-full bg-destructive" : "w-full"}
              disabled={isSubmitting}
              onPress={() => {
                void form.handleSubmit(onSubmit)();
              }}
            >
              {isSubmitting
                ? "Signing In..."
                : buttonError
                  ? "Invalid credentials"
                  : "Sign In"}
            </Button>
          </View>
        </Form>

        {/* OAuth divider — mirrors web's "or continue with" treatment */}
        <View className="flex-row items-center my-md">
          <View className="flex-1 border-t border-border" />
          <Text className="text-meta uppercase text-muted-foreground px-sm">
            Or continue with
          </Text>
          <View className="flex-1 border-t border-border" />
        </View>

        <GoogleSignInButton mode="login" className="w-full" />

        <View className="flex-row items-center justify-center flex-wrap">
          <Button
            variant="link"
            onPress={() => router.push("/forgot-password")}
          >
            Forgot password?
          </Button>
          <Button
            variant="link"
            onPress={() => router.push("/signup")}
          >
            Don&apos;t have an account?
          </Button>
        </View>
      </View>
    </AuthFormShell>
  );
}
