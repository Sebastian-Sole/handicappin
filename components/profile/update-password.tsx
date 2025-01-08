"use client";
import { useState } from "react";
import { toast } from "../ui/use-toast";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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

interface UpdatePasswordProps {
  token: string;
  email: string;
}

const UpdatePassword = ({ token, email }: UpdatePasswordProps) => {
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");

  const handleSubmit = async (values: z.infer<typeof forgotPasswordSchema>) => {
    setLoading(true);

    if (!token || !password) {
      toast({
        title: "Error",
        description: "Token or password is missing",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: "Error",
        description: "Passwords do not match",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    try {
      const response = await fetch(`${URL}/functions/v1/update-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast({
          title: "Error",
          description: response.statusText,
          variant: "destructive",
        });
        setLoading(false);
        throw new Error(data.error || "Failed to update password");
      }
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
      throw new Error(err);
    }
    toast({
      title: "✅ Success",
      description: "Password updated successfully!",
    });
    setLoading(false);
  };

  const forgotPasswordSchema = z.object({
    email: z.string(),
    password: z.string(),
    confirmPassword: z.string(),
  });

  const form = useForm<z.infer<typeof forgotPasswordSchema>>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: email,
    },
  });

  return (
    <div className="mx-auto max-w-sm space-y-6 py-8 sm:min-w-[40%] min-h-full w-[90%]">
      <div className="space-y-2 text-left">
        <h1 className="text-3xl font-bold">Update Password</h1>
        <CardDescription>Enter your new password to update it</CardDescription>
      </div>
      <div className="space-y-4">
        <Form {...form}>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              form.handleSubmit(handleSubmit)();
            }}
            className="space-y-8"
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
                        value={email}
                        disabled
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
                    <FormLabel>New Password</FormLabel>
                    <FormControl>
                      <Input
                        id="password"
                        type="password"
                        required
                        {...field}
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          form.setValue("password", e.target.value);
                        }}
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
                        value={confirmPassword}
                        onChange={(e) => {
                          setConfirmPassword(e.target.value);
                          form.setValue("confirmPassword", e.target.value);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Updating..." : "Update password"}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
};

export default UpdatePassword;
