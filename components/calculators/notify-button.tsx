"use client";

import { useState } from "react";
import { User } from "@supabase/supabase-js";
import { api } from "@/trpc/react";
import { FormFeedback } from "../ui/form-feedback";
import { SaveStateButton, type SaveState } from "../ui/save-state-button";
import type { FeedbackState } from "@/types/feedback";

interface NotifyButtonProps {
  user: User | null;
}

const NotifyButton = ({ user }: NotifyButtonProps) => {
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);

  // Update preferences mutation
  const { mutate: updatePreferences } = api.auth.updateEmailPreferences.useMutation({
    onSuccess: () => {
      setSaveState("saved");
      setFeedback(null);
    },
    onError: (error) => {
      setSaveState("error");
      setFeedback({
        type: "error",
        message: error.message,
      });
      setTimeout(() => setSaveState("idle"), 2000);
    },
  });

  const onClick = () => {
    if (!user) return;

    setSaveState("saving");
    setFeedback(null);
    updatePreferences({
      featureUpdates: true,
    });
  };

  return (
    <div className="mt-lg space-y-md">
      {feedback && (
        <FormFeedback
          type={feedback.type}
          message={feedback.message}
        />
      )}
      <SaveStateButton
        state={saveState}
        variant="secondary"
        onClick={onClick}
        className="transition-all duration-300"
        idleLabel="Notify me when they are ready"
        savingLabel="Saving..."
        savedLabel="Subscribed!"
        errorLabel="Notify me when they are ready"
      />
    </div>
  );
};

export default NotifyButton;
