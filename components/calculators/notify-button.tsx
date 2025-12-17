"use client";

import { useState } from "react";
import { Button } from "../ui/button";
import { User } from "@supabase/supabase-js";
import { useToast } from "../ui/use-toast";
import { api } from "@/trpc/react";

interface NotifyButtonProps {
  user: User | null;
}

const NotifyButton = ({ user }: NotifyButtonProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Update preferences mutation
  const { mutate: updatePreferences } = api.auth.updateEmailPreferences.useMutation({
    onSuccess: () => {
      setIsLoading(false);
      toast({
        title: "Welcome to the club!",
        description: "We will notify you when the calculators are ready!",
      });
    },
    onError: (error) => {
      setIsLoading(false);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onClick = () => {
    if (!user) return;

    setIsLoading(true);
    updatePreferences({
      featureUpdates: true,
    });
  };

  return (
    <div className="mt-6">
      <Button
        variant={"secondary"}
        onClick={onClick}
        disabled={isLoading}
      >
        {isLoading ? "Saving..." : "Notify me when they are ready"}
      </Button>
    </div>
  );
};

export default NotifyButton;
