"use client";

import { useState } from "react";
import { Button } from "../ui/button";
import { User } from "@supabase/supabase-js";
import { api } from "@/trpc/react";
import { FormFeedback } from "../ui/form-feedback";
import { Check } from "lucide-react";

interface NotifyButtonProps {
  user: User | null;
}

interface FeedbackState {
  type: "success" | "error" | "info";
  message: string;
}

type ButtonState = "idle" | "loading" | "subscribed" | "error";

const NotifyButton = ({ user }: NotifyButtonProps) => {
  const [buttonState, setButtonState] = useState<ButtonState>("idle");
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);

  // Update preferences mutation
  const { mutate: updatePreferences } = api.auth.updateEmailPreferences.useMutation({
    onSuccess: () => {
      setButtonState("subscribed");
      setFeedback(null);
    },
    onError: (error) => {
      setButtonState("error");
      setFeedback({
        type: "error",
        message: error.message,
      });
      setTimeout(() => setButtonState("idle"), 2000);
    },
  });

  const onClick = () => {
    if (!user) return;

    setButtonState("loading");
    setFeedback(null);
    updatePreferences({
      featureUpdates: true,
    });
  };

  return (
    <div className="mt-6 space-y-4">
      {feedback && (
        <FormFeedback
          type={feedback.type}
          message={feedback.message}
        />
      )}
      <Button
        variant={"secondary"}
        onClick={onClick}
        disabled={buttonState === "loading" || buttonState === "subscribed"}
        className={`transition-all duration-300 ${
          buttonState === "subscribed" ? "bg-green-600 hover:bg-green-600 text-white" : ""
        }`}
      >
        {buttonState === "loading" && "Saving..."}
        {buttonState === "subscribed" && (
          <>
            <Check className="mr-2 h-4 w-4" />
            Subscribed!
          </>
        )}
        {(buttonState === "idle" || buttonState === "error") && "Notify me when they are ready"}
      </Button>
    </div>
  );
};

export default NotifyButton;
