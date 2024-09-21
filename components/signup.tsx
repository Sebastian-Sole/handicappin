"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Input } from "./ui/input";
import { useRouter } from "next/navigation";
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
import { createClientComponentClient } from "@/utils/supabase/client";
import { zodResolver } from "@hookform/resolvers/zod";
import { api } from "@/trpc/react";
import { toast } from "./ui/use-toast";
import { useState } from "react";

export function Signup() {
  const [loading, setLoading] = useState(false);

  const router = useRouter();
  const supabase = createClientComponentClient();

  const signupSchema = z.object({
    name: z.string().min(2).max(50),
    email: z.string().min(2).max(50),
    password: z.string().min(6).max(50),
  });

  const form = useForm<z.infer<typeof signupSchema>>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
    },
  });

  const { mutate, isPending } = api.auth.signup.useMutation({
    onSuccess: async (data) => {
      try {
        await supabase.auth.setSession(data);
        console.log("Signed up successfully");
        router.push("/");
      } catch (error) {
        console.error("Error setting session:", error);
        toast({
          title: "Error setting session",
          description:
            "There was an issue establishing your session. Please try logging in again.",
        });
        router.push("/login");
      }
    },
    onError: (e) => {
      console.error("Error signing up");
      console.log(e);
      toast({
        title: "Error logging in",
        description: e.message,
      });
      router.push("/error");
    },
  });

  const onSubmit = async (values: z.infer<typeof signupSchema>) => {
    setLoading(true);
    try {
      // Sign up the user
      const { data: signupData, error: signupError } =
        await supabase.auth.signUp({
          email: values.email,
          password: values.password,
        });

      if (signupError) {
        throw signupError;
      }

      if (!signupData.user?.id) {
        throw new Error("User ID is undefined after signup.");
      }

      // Create user profile
      const { error: profileError } = await supabase.from("Profile").insert([
        {
          email: values.email,
          name: values.name,
          handicapIndex: 54,
          id: signupData.user.id,
        },
      ]);

      if (profileError) {
        throw profileError;
      }

      // Log in the user
      const { data: loginData, error: loginError } =
        await supabase.auth.signInWithPassword({
          email: values.email,
          password: values.password,
        });

      if (loginError) {
        throw loginError;
      }

      if (!loginData.session) {
        throw new Error("Session data is undefined after login.");
      }

      // Set the session client-side
      const { error: setSessionError } = await supabase.auth.setSession(
        loginData.session
      );

      if (setSessionError) {
        throw setSessionError;
      }

      toast({
        title: "Signed up successfully!",
        description: "You have been signed up and logged in.",
      });

      // Force a full page reload to ensure server-side components recognize the session
      window.location.href = "/";
    } catch (error: any) {
      console.error("Error during sign up:", error);
      toast({
        title: "Error signing up",
        description: error.message || "An error occurred during sign up.",
      });
      // Optionally, redirect to an error page or handle the error appropriately
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-sm space-y-6 py-4 md:py-4 lg:py-4 xl:py-4 sm:min-w-[40%] min-h-full w-[90%]">
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-bold">Sign Up</h1>
        <p className="text-muted-foreground">
          Create a new account to get started
        </p>
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
                    <FormDescription>Enter your full name.</FormDescription>
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
            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? "Loading..." : "Sign Up"}
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

function ChromeIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="4" />
      <line x1="21.17" x2="12" y1="8" y2="8" />
      <line x1="3.95" x2="8.54" y1="6.06" y2="14" />
      <line x1="10.88" x2="15.46" y1="21.94" y2="14" />
    </svg>
  );
}

function GithubIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
      <path d="M9 18c-4.51 2-5-2-7-2" />
    </svg>
  );
}
