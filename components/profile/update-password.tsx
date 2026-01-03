"use client";
import { useState } from "react";
import { toast } from "../ui/use-toast";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { resetPasswordSchema } from "@/types/auth";
import { CardDescription } from "../ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../ui/form";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "../ui/input-otp";
import { Alert, AlertDescription } from "../ui/alert";
import { useRouter } from "next/navigation";

interface UpdatePasswordProps {
  email?: string;
}

const UpdatePassword = ({ email: initialEmail }: UpdatePasswordProps) => {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const form = useForm<z.infer<typeof resetPasswordSchema>>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      email: initialEmail || "",
      otp: "",
      password: "",
      confirmPassword: "",
    },
  });

  const handleSubmit = async (values: z.infer<typeof resetPasswordSchema>) => {
    setLoading(true);

    const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    try {
      const response = await fetch(
        `${URL}/functions/v1/verify-password-reset-otp`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: values.email,
            otp: values.otp,
            newPassword: values.password
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        toast({
          title: "Error",
          description: data.error || response.statusText,
          variant: "destructive",
        });
        setLoading(false);

        // Clear OTP on error
        form.setValue("otp", "");
        return;
      }

      toast({
        title: "✅ Success",
        description: "Password reset successfully! Redirecting to login...",
      });

      // Redirect to login after 2 seconds
      setTimeout(() => {
        router.push("/login");
      }, 2000);
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "An unexpected error occurred",
        variant: "destructive",
      });
      setLoading(false);
      form.setValue("otp", "");
    }
  };

  return (
    <div className="mx-auto max-w-sm space-y-6 py-8 sm:min-w-[40%] min-h-full w-[90%]">
      <div className="space-y-2 text-left">
        <h1 className="text-3xl font-bold">Reset Password</h1>
        <CardDescription>
          Enter the verification code from your email and your new password
        </CardDescription>
      </div>
      <div className="space-y-4">
        <Form {...form}>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              form.handleSubmit(handleSubmit)();
            }}
            className="space-y-6"
          >
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
                        required
                        {...field}
                        disabled={!!initialEmail}
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
                name="otp"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="block text-center">
                      Verification Code
                    </FormLabel>
                    <FormControl>
                      <div className="flex justify-center">
                        <InputOTP
                          maxLength={6}
                          {...field}
                          disabled={loading}
                        >
                          <InputOTPGroup>
                            <InputOTPSlot index={0} />
                            <InputOTPSlot index={1} />
                            <InputOTPSlot index={2} />
                            <InputOTPSlot index={3} />
                            <InputOTPSlot index={4} />
                            <InputOTPSlot index={5} />
                          </InputOTPGroup>
                        </InputOTP>
                      </div>
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
                    <FormLabel>New Password</FormLabel>
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

            <div className="space-y-2">
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm Password</FormLabel>
                    <FormControl>
                      <Input
                        id="confirmPassword"
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
              className="w-full"
              disabled={loading || form.watch("otp").length !== 6}
            >
              {loading ? "Resetting..." : "Reset Password"}
            </Button>
          </form>
        </Form>

        <Alert className="mt-4">
          <AlertDescription className="text-xs">
            <strong>Tip:</strong> Check your email for the 6-digit verification
            code. The code expires in 15 minutes.
          </AlertDescription>
        </Alert>
      </div>
    </div>
  );
};

export default UpdatePassword;
