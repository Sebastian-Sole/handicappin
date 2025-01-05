"use client";

import { useState } from "react";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Tables } from "@/types/supabase";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../ui/form";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { createClientComponentClient } from "@/utils/supabase/client";
import { User } from "@supabase/supabase-js";
import { api } from "@/trpc/react";
import { toast } from "../ui/use-toast";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

interface UserProfileProps {
  authUser: User;
  profile: Tables<"Profile">;
}

const UserProfile = ({ profile, authUser }: UserProfileProps) => {
  const { id, name: profileName } = profile;
  const [email, setEmail] = useState<string>(authUser.email || "");
  const [name, setName] = useState<string>(profileName || "");
  const [loading, setLoading] = useState(false);
  const supabase = createClientComponentClient();

  const { mutate } = api.auth.updateProfile.useMutation({
    onSuccess: () => {
      toast({
        title: "Profile updated",
        description: "Your profile has been updated",
      });
      setLoading(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      setLoading(false);
    },
  });

  const handleSubmit = async (values: z.infer<typeof updateProfileSchema>) => {
    console.log("Submitting");
    setLoading(true);
    const { data, error } = await supabase.auth.updateUser({
      email: values.email,
    });

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    mutate({
      id,
      name: values.name,
      email: values.email,
    });
  };

  const updateProfileSchema = z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
  });

  const form = useForm<z.infer<typeof updateProfileSchema>>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: {
      id: id,
      name: name,
      email: email,
    },
  });

  return (
    <div className="mx-auto max-w-sm space-y-6 py-8 sm:min-w-[40%] min-h-full w-[90%]">
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-bold">Edit Profile</h1>
      </div>
      <div className="space-y-4">
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-8"
          >
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
                        value={name}
                        onChange={(e) => {
                          setName(e.target.value);
                          form.setValue("name", e.target.value);
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
                        onChange={(e) => {
                          setEmail(e.target.value);
                          form.setValue("email", e.target.value);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Updating..." : "Update profile"}
            </Button>
            <div className="flex items-center justify-center flex-wrap">
              <Link href={"/forgot-password"}>
                <Button variant={"link"}>Change password?</Button>
              </Link>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
};
export default UserProfile;
