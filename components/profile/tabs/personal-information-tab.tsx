"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tables } from "@/types/supabase";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { createClientComponentClient } from "@/utils/supabase/client";
import { User } from "@supabase/supabase-js";
import { api } from "@/trpc/react";
import { toast } from "@/components/ui/use-toast";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check } from "lucide-react";

interface PersonalInformationTabProps {
  authUser: User;
  profile: Tables<"profile">;
}

const updateProfileSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
});

export function PersonalInformationTab({
  profile,
  authUser,
}: PersonalInformationTabProps) {
  const { id, name: profileName } = profile;
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">(
    "idle"
  );
  const supabase = createClientComponentClient();

  const { mutate } = api.auth.updateProfile.useMutation({
    onSuccess: () => {
      setSaveState("saved");

      // Reset button state after 2 seconds
      setTimeout(() => {
        setSaveState("idle");
      }, 2000);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      setSaveState("idle");
    },
  });

  const form = useForm<z.infer<typeof updateProfileSchema>>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: {
      id: id,
      name: profileName || "",
      email: authUser.email || "",
    },
  });

  const handleSubmit = async (values: z.infer<typeof updateProfileSchema>) => {
    setSaveState("saving");
    const { data, error } = await supabase.auth.updateUser({
      email: values.email,
    });

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      setSaveState("idle");
      return;
    }

    mutate({
      id,
      name: values.name,
      email: values.email,
    });
  };

  const copySupportEmailToClipboard = () => {
    navigator.clipboard.writeText("sebastiansole@handicappin.com");
    toast({
      title: "Email copied",
      description: "Support email has been copied to your clipboard",
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold mb-2">Personal Information</h2>
        <p className="text-muted-foreground">
          Manage your account details and preferences
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input id="name" type="text" required {...field} />
                </FormControl>
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
                <FormControl>
                  <Input id="email" type="email" required {...field} disabled />
                </FormControl>
                <FormDescription>
                  Want to update your email?{" "}
                  <Button
                    type="button"
                    variant={"link"}
                    onClick={copySupportEmailToClipboard}
                    className="px-0 h-auto"
                  >
                    Contact Support
                  </Button>
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex items-center justify-between pt-4">
            <Link href="/forgot-password">
              <Button variant="link" className="px-0">
                Change password?
              </Button>
            </Link>
            <Button
              type="submit"
              disabled={saveState === "saving" || saveState === "saved"}
              className={`transition-all duration-300 ${
                saveState === "saved"
                  ? "bg-green-600 hover:bg-green-600"
                  : saveState === "saving"
                  ? "bg-muted text-muted-foreground hover:bg-muted"
                  : ""
              }`}
            >
              {saveState === "saving" && (
                <span className="flex items-center gap-2">
                  <span className="animate-spin">⏳</span>
                  Saving...
                </span>
              )}
              {saveState === "saved" && (
                <span className="flex items-center gap-2">
                  <Check className="h-4 w-4" />
                  Saved!
                </span>
              )}
              {saveState === "idle" && "Save Changes"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
