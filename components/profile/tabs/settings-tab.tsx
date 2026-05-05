"use client";

import { useState, useSyncExternalStore } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useTheme } from "next-themes";
import { Moon, Sun, Monitor } from "lucide-react";
import { api } from "@/trpc/react";
import { DataExportSection } from "../data-export-section";
import { AccountDeletionSection } from "../account-deletion-section";
import { FormFeedback } from "@/components/ui/form-feedback";
import { SaveStateButton } from "@/components/ui/save-state-button";
import { H2, H3 } from "@/components/ui/typography";
import type { FeedbackState } from "@/types/feedback";

const subscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

export function SettingsTab() {
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">(
    "idle"
  );
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);

  // Fetch email preferences on mount
  // Auth is enforced server-side by authedProcedure
  const { data: preferences, isLoading } = api.auth.getEmailPreferences.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  // Notification preferences - use fetched value or default
  const [featureUpdatesOverride, setFeatureUpdatesOverride] = useState<boolean | null>(null);
  const featureUpdates = featureUpdatesOverride ?? preferences?.feature_updates ?? true;

  const setFeatureUpdates = (value: boolean) => {
    setFeatureUpdatesOverride(value);
  };

  // Update preferences mutation
  const { mutate: updatePreferences } = api.auth.updateEmailPreferences.useMutation({
    onSuccess: () => {
      setSaveState("saved");
      setFeedback(null);
      setTimeout(() => setSaveState("idle"), 2000);
    },
    onError: (error) => {
      setFeedback({
        type: "error",
        message: error.message,
      });
      setSaveState("idle");
    },
  });

  const handleSaveSettings = async () => {
    if (isLoading) return;
    setSaveState("saving");
    setFeedback(null);

    updatePreferences({
      featureUpdates,
    });
  };

  return (
    <div className="space-y-lg">
      {/* Header */}
      <div>
        <H2 className="text-2xl font-semibold mb-sm">Settings</H2>
        <p className="text-muted-foreground">
          Manage your notifications and appearance preferences
        </p>
      </div>

      {/* Inline feedback display */}
      {feedback && (
        <FormFeedback
          type={feedback.type}
          message={feedback.message}
        />
      )}

      {/* Notifications Section */}
      <div className="surface p-lg">
        <H3 className="text-xl font-semibold mb-md">Notifications</H3>
        {isLoading ? (
          <div className="space-y-md">
            <div className="flex items-center justify-between animate-pulse">
              <div className="space-y-sm">
                <div className="h-5 w-32 bg-muted rounded" />
                <div className="h-4 w-64 bg-muted rounded" />
              </div>
              <div className="h-6 w-11 bg-muted rounded-full" />
            </div>
          </div>
        ) : (
          <div className="space-y-md">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="feature-updates">Feature Updates</Label>
                <p className="text-sm text-muted-foreground">
                  Receive emails about new features and improvements
                </p>
              </div>
              <Switch
                id="feature-updates"
                checked={featureUpdates}
                onCheckedChange={setFeatureUpdates}
                disabled={isLoading}
              />
            </div>
          </div>
        )}
      </div>

      {/* Theme Section */}
      <div className="surface p-lg">
        <H3 className="text-xl font-semibold mb-md">Appearance</H3>
        <div className="space-y-md">
          <div className="space-y-sm">
            <Label>Theme</Label>
            {!mounted ? (
              // Show skeleton loader while mounting to prevent hydration mismatch
              <div className="grid grid-cols-3 gap-sm">
                <div className="flex flex-col items-center gap-sm p-md rounded-lg border-2 border-muted animate-pulse">
                  <div className="h-6 w-6 bg-muted rounded" />
                  <div className="h-4 w-12 bg-muted rounded" />
                </div>
                <div className="flex flex-col items-center gap-sm p-md rounded-lg border-2 border-muted animate-pulse">
                  <div className="h-6 w-6 bg-muted rounded" />
                  <div className="h-4 w-12 bg-muted rounded" />
                </div>
                <div className="flex flex-col items-center gap-sm p-md rounded-lg border-2 border-muted animate-pulse">
                  <div className="h-6 w-6 bg-muted rounded" />
                  <div className="h-4 w-12 bg-muted rounded" />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-sm">
                {/* Light Theme Button */}
                <button
                  onClick={() => setTheme("light")}
                  className={`flex flex-col items-center gap-sm p-md rounded-lg border-2 transition-all hover:bg-muted/50 ${
                    theme === "light"
                      ? "border-primary bg-primary/5"
                      : "border-muted"
                  }`}
                >
                  <Sun className="h-6 w-6" />
                  <span className="text-sm font-medium">Light</span>
                </button>

                {/* Dark Theme Button */}
                <button
                  onClick={() => setTheme("dark")}
                  className={`flex flex-col items-center gap-sm p-md rounded-lg border-2 transition-all hover:bg-muted/50 ${
                    theme === "dark"
                      ? "border-primary bg-primary/5"
                      : "border-muted"
                  }`}
                >
                  <Moon className="h-6 w-6" />
                  <span className="text-sm font-medium">Dark</span>
                </button>

                {/* System Theme Button */}
                <button
                  onClick={() => setTheme("system")}
                  className={`flex flex-col items-center gap-sm p-md rounded-lg border-2 transition-all hover:bg-muted/50 ${
                    theme === "system"
                      ? "border-primary bg-primary/5"
                      : "border-muted"
                  }`}
                >
                  <Monitor className="h-6 w-6" />
                  <span className="text-sm font-medium">System</span>
                </button>
              </div>
            )}
            <p className="text-sm text-muted-foreground">
              Choose how the app looks to you
            </p>
          </div>
        </div>
      </div>

      {/* Data Export Section */}
      <DataExportSection />

      {/* Account Deletion Section */}
      <AccountDeletionSection />

      {/* Save Button */}
      <div className="flex justify-end pt-md">
        <SaveStateButton
          onClick={handleSaveSettings}
          state={saveState}
          idleLabel="Save Changes"
          savedLabel="Saved!"
          disabled={isLoading}
          className="transition-all duration-300"
        />
      </div>
    </div>
  );
}
