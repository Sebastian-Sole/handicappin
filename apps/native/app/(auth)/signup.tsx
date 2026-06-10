/**
 * Signup — native twin of apps/web/app/(auth)/signup/page.tsx +
 * components/auth/signup.tsx. Same flow: validated form (name/email/
 * password/legal consent), signUpUser (supabase signUp + create-profile
 * edge function), success → verify-signup with the email prefilled.
 * Legal documents open the website (web-only routes, ledger §1).
 */
import { zodResolver } from "@hookform/resolvers/zod";
import { router } from "expo-router";
import type { Href } from "expo-router";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { Text, View } from "react-native";
import type { z } from "zod";

import { AuthFormShell } from "@/components/auth/auth-form-shell";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { DataSettledMarker } from "@/components/data-settled";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { FormFeedback } from "@/components/ui/form-feedback";
import { Input } from "@/components/ui/input";
import { signUpUser, signupSchema } from "@/lib/auth/sign-up";
import { openLegalDocument } from "@/lib/legal";

interface FeedbackState {
  type: "success" | "error" | "info";
  message: string;
}

export default function SignupScreen() {
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [buttonError, setButtonError] = useState(false);
  const buttonErrorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const form = useForm<z.infer<typeof signupSchema>>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      legalConsent: false,
    },
  });

  const showButtonError = () => {
    setButtonError(true);
    if (buttonErrorTimeoutRef.current) {
      clearTimeout(buttonErrorTimeoutRef.current);
    }
    buttonErrorTimeoutRef.current = setTimeout(() => {
      setButtonError(false);
    }, 2000);
  };

  const onSubmit = async (values: z.infer<typeof signupSchema>) => {
    setLoading(true);
    setFeedback(null);
    setButtonError(false);

    try {
      const result = await signUpUser(values);

      if (!result.success) {
        const isDuplicateKeyError =
          result.message.includes("23505") ||
          result.message.toLowerCase().includes("duplicate key") ||
          result.message.toLowerCase().includes("unique constraint");

        if (result.error === "email_in_use" || isDuplicateKeyError) {
          setFeedback({
            type: "error",
            message:
              "This email is already in use. Please login or reset your password.",
          });
          showButtonError();
          setLoading(false);
          return;
        }

        setFeedback({ type: "error", message: result.message });
        setLoading(false);
        return;
      }

      setFeedback({
        type: "success",
        message: "Please check your email and enter the verification code.",
      });

      setTimeout(() => {
        // typed-routes-forward-cast: target screen lands later this cluster
        router.push(
          `/verify-signup?email=${encodeURIComponent(values.email)}` as Href,
        );
      }, 1500);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "An error occurred during sign up.";

      const isDuplicateKeyError =
        errorMessage.includes("23505") ||
        errorMessage.toLowerCase().includes("duplicate key") ||
        errorMessage.toLowerCase().includes("unique constraint");

      if (isDuplicateKeyError) {
        setFeedback({
          type: "error",
          message:
            "This email is already in use. Please login or reset your password.",
        });
        showButtonError();
        setLoading(false);
        return;
      }

      setFeedback({ type: "error", message: errorMessage });
    }
    setLoading(false);
  };

  return (
    <AuthFormShell
      testID="signup-screen"
      title="Sign Up"
      description="Create a new account to get started"
    >
      <DataSettledMarker settled />
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
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <Input
                    testID="signup-name"
                    placeholder="Birdie Mulligan"
                    autoComplete="name"
                    value={field.value}
                    onChangeText={field.onChange}
                    onBlur={field.onBlur}
                  />
                  <Text className="text-body-sm text-muted-foreground">
                    Enter your full name
                  </Text>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <Input
                    testID="signup-email"
                    placeholder="double@bogey.com"
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
                    testID="signup-password"
                    secureTextEntry
                    autoComplete="new-password"
                    value={field.value}
                    onChangeText={field.onChange}
                    onBlur={field.onBlur}
                  />
                  <Text className="text-body-sm text-muted-foreground">
                    Enter a password
                  </Text>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="legalConsent"
              render={({ field }) => (
                <FormItem className="flex-row items-start gap-sm">
                  <Checkbox
                    testID="signup-consent"
                    accessibilityLabel="I agree to the Terms of Service and Privacy Policy"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                  <View className="flex-1 gap-xs">
                    <Text className="text-meta text-muted-foreground">
                      I agree to the{" "}
                      <Text
                        className="text-meta text-muted-foreground underline"
                        accessibilityRole="link"
                        onPress={() => void openLegalDocument("terms")}
                      >
                        Terms of Service
                      </Text>{" "}
                      and{" "}
                      <Text
                        className="text-meta text-muted-foreground underline"
                        accessibilityRole="link"
                        onPress={() => void openLegalDocument("privacy")}
                      >
                        Privacy Policy
                      </Text>
                    </Text>
                    <FormMessage />
                  </View>
                </FormItem>
              )}
            />
            <Button
              testID="signup-submit"
              className={buttonError ? "w-full bg-destructive" : "w-full"}
              disabled={loading}
              onPress={() => {
                void form.handleSubmit(onSubmit)();
              }}
            >
              {loading
                ? "Signing up..."
                : buttonError
                  ? "Email already in use"
                  : "Sign Up"}
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

        <GoogleSignInButton mode="signup" className="w-full" />

        <View className="flex-row items-center justify-center flex-wrap">
          <Button
            variant="link"
            // typed-routes-forward-cast: target screen lands later this cluster
            onPress={() => router.push("/forgot-password" as Href)}
          >
            Forgot password?
          </Button>
          <Button variant="link" onPress={() => router.push("/login")}>
            Already have an account?
          </Button>
        </View>
      </View>
    </AuthFormShell>
  );
}
