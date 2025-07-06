"use client";

import { Button } from "../ui/button";
import { User } from "@supabase/supabase-js";
import { toast } from "../ui/use-toast";

interface NotifyButtonProps {
  user: User | null;
}

const NotifyButton = ({ user }: NotifyButtonProps) => {
  const onClick = () => {
    // TODO: Notification logic
    toast({
      title: "✅ Welcome to the club!",
      description: "We will notify you when the calculators are ready!",
    });
  };
  return (
    <div className="mt-6">
      <Button variant={"secondary"} onClick={onClick}>
        Notify me when they are ready
      </Button>
    </div>
  );
};

export default NotifyButton;
