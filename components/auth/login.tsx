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
import { useRouter } from "next/navigation";
import useMounted from "@/hooks/useMounted";
import { Skeleton } from "../ui/skeleton";
import { Input } from "../ui/input";
import { useToast } from "../ui/use-toast";

export function Login() {
  const isMounted = useMounted();
  const supabase = createClientComponentClient();
  const router = useRouter();
  const { toast } = useToast();

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
    const { error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    });

    if (error) {
      console.log(error);
      toast({
        title: "Error logging in",
        description: error.message,
      });
      router.push("/error");
    }
    router.push("/");
    router.refresh();
  };

  if (!isMounted) {
    // Todo: Add a login form skeleton
    return <Skeleton />;
  }

  return (
    <div className="mx-auto max-w-sm space-y-6 py-4 md:py-4 lg:py-4 xl:py-4 sm:min-w-[40%] min-h-full w-[90%]">
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-bold">Welcome Back</h1>
        <p className="text-muted-foreground">
          Sign in to your account to continue
        </p>
      </div>
      <div className="space-y-4">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
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
            <Button type="submit" className="w-full">
              Sign In
            </Button>

            <div className="flex items-center justify-center flex-wrap">
              <Link href="/forgot-password" className="" prefetch={false}>
                <Button variant={"link"}> Forgot password?</Button>
              </Link>
              <Link href="/signup" className="" prefetch={false}>
                <Button variant={"link"}>Don&apos;t have an account?</Button>
              </Link>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}
