"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";
import { z } from "zod";
import { useForm } from "react-hook-form";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useEffect, useRef } from "react";
import { signupSchema } from "@/types/auth";
import { signUpUser } from "@/utils/auth/helpers";
import { Input } from "../ui/input";
import { useRouter } from "next/navigation";
import { FormFeedback } from "../ui/form-feedback";
import type { FeedbackState } from "@/types/feedback";

interface SignupProps {
  description?: string;
  notify?: boolean;
}

export function Signup({
  description = "Create a new account to get started",
  notify = false,
}: SignupProps) {
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [buttonError, setButtonError] = useState(false);
  const buttonErrorTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const router = useRouter();

  const form = useForm<z.infer<typeof signupSchema>>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
    },
  });

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

  const onSubmit = async (values: z.infer<typeof signupSchema>) => {
    setLoading(true);
    setFeedback(null);
    setButtonError(false);

    try {
      const result = await signUpUser(values);

      if (!result.success) {
        if (result.error === "email_in_use") {
          setFeedback({
            type: "error",
            message: "This email is already in use. Please login or reset your password.",
          });
          showButtonError();
          setLoading(false);
          return;
        }

        // Handle duplicate key constraint - check for PostgreSQL unique violation patterns
        // Uses multiple patterns for resilience against message format changes
        const isDuplicateKeyError =
          result.message.includes("23505") || // PostgreSQL unique_violation error code
          result.message.toLowerCase().includes("duplicate key") ||
          result.message.toLowerCase().includes("unique constraint");

        if (isDuplicateKeyError) {
          setFeedback({
            type: "error",
            message: "This email is already in use. Please login or reset your password.",
          });
          showButtonError();
          setLoading(false);
          return;
        }

        setFeedback({
          type: "error",
          message: result.message,
        });
        setLoading(false);
        return;
      }

      setFeedback({
        type: "success",
        message: "Please check your email and enter the verification code.",
      });

      setTimeout(() => {
        router.push(`/verify-signup?email=${encodeURIComponent(values.email)}`);
      }, 1500);
    } catch (error: unknown) {
      console.error("Error during sign up:", error);
      const errorMessage = error instanceof Error ? error.message : "An error occurred during sign up.";

      // Check for duplicate key constraint from profile creation edge function
      const isDuplicateKeyError =
        errorMessage.includes("23505") || // PostgreSQL unique_violation error code
        errorMessage.toLowerCase().includes("duplicate key") ||
        errorMessage.toLowerCase().includes("unique constraint");

      if (isDuplicateKeyError) {
        setFeedback({
          type: "error",
          message: "This email is already in use. Please login or reset your password.",
        });
        showButtonError();
        setLoading(false);
        return;
      }

      setFeedback({
        type: "error",
        message: errorMessage,
      });
    }

    if (notify) {
      // TODO: Implement notification logic
    }
    setLoading(false);
  };

  const clearFeedback = () => {
    setFeedback(null);
  };

  return (
    <div className="mx-auto max-w-sm space-y-6 py-4 md:py-4 lg:py-4 xl:py-4 sm:min-w-[40%] min-h-full w-[90%]">
      {feedback && (
        <FormFeedback
          type={feedback.type}
          message={feedback.message}
          className="mb-4"
          onClose={clearFeedback}
        />
      )}
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-bold">Sign Up</h1>
        <p className="text-muted-foreground">{description}</p>
      </div>
      <div className="space-y-4">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <div className="space-y-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input
                        id="name"
                        type="name"
                        required
                        {...field}
                        placeholder="Birdie Mulligan"
                      />
                    </FormControl>
                    <FormDescription>Enter your full name</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="space-y-2">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        id="email"
                        type="email"
                        placeholder="double@bogey.com"
                        required
                        {...field}
                      />
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
                    <FormDescription>Enter a password</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              ></FormField>
            </div>
            <Button
              type="submit"
              className={buttonError ? "w-full bg-destructive hover:bg-destructive/90" : "w-full"}
              disabled={loading}
            >
              {loading ? "Signing up..." : buttonError ? "Email already in use" : "Sign Up"}
            </Button>

            <div className="flex items-center justify-center flex-wrap">
              <Link href="/forgot-password" className="" prefetch={false}>
                <Button variant={"link"}>Forgot password?</Button>
              </Link>
              <Link href="/login" prefetch={false}>
                <Button variant={"link"}>Already have an account?</Button>
              </Link>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}
