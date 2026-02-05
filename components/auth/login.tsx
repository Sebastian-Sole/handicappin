"use client";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { createClientComponentClient } from "@/utils/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import useMounted from "@/hooks/useMounted";
import { Skeleton } from "../ui/skeleton";
import { Input } from "../ui/input";
import { VerificationBox } from "./verification-box";
import { useState, useEffect, useRef } from "react";
import { getBillingFromJWT } from "@/utils/supabase/jwt";
import { FormFeedback } from "../ui/form-feedback";
import type { FeedbackState } from "@/types/feedback";
import { GoogleSignInButton } from "./google-sign-in-button";

export function Login() {
  const isMounted = useMounted();
  const supabase = createClientComponentClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isVerified = searchParams.get("verified");
  const errorParam = searchParams.get("error");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [buttonError, setButtonError] = useState(false);
  const buttonErrorTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Show OAuth error from URL query parameter
  useEffect(() => {
    if (errorParam) {
      setFeedback({
        type: "error",
        message: decodeURIComponent(errorParam),
      });
    }
  }, [errorParam]);

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (buttonErrorTimeoutRef.current) {
        clearTimeout(buttonErrorTimeoutRef.current);
      }
    };
  }, []);

  const showButtonError = () => {
    setButtonError(true);
    if (buttonErrorTimeoutRef.current) {
      clearTimeout(buttonErrorTimeoutRef.current);
    }
    buttonErrorTimeoutRef.current = setTimeout(() => {
      setButtonError(false);
    }, 2000);
  };

  const clearFeedback = () => {
    setFeedback(null);
  };

  const loginSchema = z.object({
    email: z.string().min(2).max(50),
    password: z.string().min(6).max(50),
  });

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (values: z.infer<typeof loginSchema>) => {
    setIsSubmitting(true);
    setFeedback(null);
    setButtonError(false);

    const { error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    });

    if (error) {
      // Check if the error is due to unverified email
      const isEmailNotConfirmed =
        error.message.toLowerCase().includes("email not confirmed") ||
        error.code === "email_not_confirmed";

      if (isEmailNotConfirmed) {
        setFeedback({
          type: "info",
          message: "Please verify your email before signing in. Redirecting to verification...",
        });
        // Redirect to verification page with email pre-filled
        setTimeout(() => {
          router.push(
            `/verify-signup?email=${encodeURIComponent(values.email)}`
          );
        }, 1500);
        setIsSubmitting(false);
        return;
      }

      // Check for invalid credentials
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

      setFeedback({
        type: "error",
        message: error.message,
      });
      setIsSubmitting(false);
      return;
    }

    // Get fresh session with JWT billing claims
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const billing = getBillingFromJWT(session);

    // Intelligent redirect based on plan status
    if (!billing?.plan) {
      // User has no plan - direct to onboarding (optimal UX)
      router.push("/onboarding");
    } else {
      // User has plan - go to home
      router.push("/");
    }
    router.refresh();
  };

  if (!isMounted) {
    // Todo: Add a login form skeleton
    return <Skeleton />;
  }

  return (
    <div className="mx-auto max-w-sm space-y-6 py-4 md:py-4 lg:py-4 xl:py-4 sm:min-w-[40%] min-h-full w-[90%]">
      {isVerified && <VerificationBox />}
      {feedback && (
        <FormFeedback
          type={feedback.type}
          message={feedback.message}
          className="mb-4"
          onClose={clearFeedback}
        />
      )}
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-bold">Welcome Back</h1>
        <p className="text-muted-foreground">
          Sign in to your account to continue
        </p>
      </div>
      <div className="space-y-4">
        <Form {...form}>
          <form onSubmit={(e) => form.handleSubmit(onSubmit)(e)} className="space-y-8">
            <div className="space-y-2">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input id="email" type="email" required {...field} />
                    </FormControl>

                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="space-y-2">
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input
                        id="password"
                        type="password"
                        required
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <Button
              type="submit"
              className={buttonError ? "w-full bg-destructive hover:bg-destructive/90" : "w-full"}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Signing In..." : buttonError ? "Invalid credentials" : "Sign In"}
            </Button>
          </form>
        </Form>

        {/* OAuth Divider */}
        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">
              Or continue with
            </span>
          </div>
        </div>

        {/* Google Sign-In Button */}
        <GoogleSignInButton mode="login" className="w-full" />

        <div className="flex items-center justify-center flex-wrap">
          <Link href="/forgot-password" className="" prefetch={false}>
            <Button variant={"link"}> Forgot password?</Button>
          </Link>
          <Link href="/signup" className="" prefetch={false}>
            <Button variant={"link"}>Don&apos;t have an account?</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
