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
import { useState } from "react";
import { signupSchema } from "@/types/auth";
import { signUpUser } from "@/utils/auth/helpers";
import { toast } from "../ui/use-toast";
import { Input } from "../ui/input";
import { useRouter } from "next/navigation";

interface SignupProps {
  description?: string;
  notify?: boolean;
}

export function Signup({
  description = "Create a new account to get started",
  notify = false,
}: SignupProps) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const form = useForm<z.infer<typeof signupSchema>>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
    },
  });

  const onSubmit = async (values: z.infer<typeof signupSchema>) => {
    setLoading(true);
    try {
      const result = await signUpUser(values);

      if (result.isResend) {
        toast({
          title: "Verification code resent",
          description:
            "A new verification code has been sent to your email. Please check your inbox.",
        });
      } else {
        toast({
          title: "Verification email sent",
          description:
            "Please check your email and enter the verification code.",
        });
      }

      router.push(`/verify-signup?email=${encodeURIComponent(values.email)}`);
    } catch (error: any) {
      console.error("Error during sign up:", error);

      // Handle specific error cases
      if (error.message.includes("Email already in use. Please login.")) {
        toast({
          title: "Email already in use",
          description: "This email is already verified. Please login instead.",
          variant: "destructive",
        });
        return;
      }

      if (
        error.message.includes(
          `duplicate key value violates unique constraint "profile_email_key"`
        )
      ) {
        toast({
          title: "Error signing up",
          description: "Email already in use. Please login.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Error signing up",
        description: error.message || "An error occurred during sign up.",
        variant: "destructive",
      });
    }
    if (notify) {
      // TODO: Implement notification logic
    }
    setLoading(false);
  };

  return (
    <div className="mx-auto max-w-sm space-y-6 py-4 md:py-4 lg:py-4 xl:py-4 sm:min-w-[40%] min-h-full w-[90%]">
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
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing up..." : "Sign Up"}
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
