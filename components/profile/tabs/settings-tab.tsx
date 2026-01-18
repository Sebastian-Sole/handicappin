"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useTheme } from "next-themes";
import { Moon, Sun, Monitor, Check } from "lucide-react";
import { api } from "@/trpc/react";
import { useToast } from "@/components/ui/use-toast";
import { DataExportSection } from "../data-export-section";
import { AccountDeletionSection } from "../account-deletion-section";

export function SettingsTab() {
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">(
    "idle"
  );
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const { toast } = useToast();

  // Notification preferences - will be loaded from database
  const [featureUpdates, setFeatureUpdates] = useState(true);

  // Fetch email preferences on mount
  // Auth is enforced server-side by authedProcedure
  const { data: preferences, isLoading } = api.auth.getEmailPreferences.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  // Update preferences mutation
  const { mutate: updatePreferences } = api.auth.updateEmailPreferences.useMutation({
    onSuccess: () => {
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2000);
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

  // Sync state with fetched preferences
  useEffect(() => {
    if (preferences) {
      setFeatureUpdates(preferences.feature_updates);
    }
  }, [preferences]);

  // Prevent hydration mismatch by only rendering theme buttons after mount
  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSaveSettings = async () => {
    if (isLoading) return;
    setSaveState("saving");

    updatePreferences({
      featureUpdates,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-semibold mb-2">Settings</h2>
        <p className="text-muted-foreground">
          Manage your notifications and appearance preferences
        </p>
      </div>

      {/* Notifications Section */}
      <div className="bg-card rounded-lg border p-6">
        <h3 className="text-xl font-semibold mb-4">Notifications</h3>
        {isLoading ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between animate-pulse">
              <div className="space-y-2">
                <div className="h-5 w-32 bg-muted rounded" />
                <div className="h-4 w-64 bg-muted rounded" />
              </div>
              <div className="h-6 w-11 bg-muted rounded-full" />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
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
      <div className="bg-card rounded-lg border p-6">
        <h3 className="text-xl font-semibold mb-4">Appearance</h3>
        <div className="space-y-4">
          <div className="space-y-3">
            <Label>Theme</Label>
            {!mounted ? (
              // Show skeleton loader while mounting to prevent hydration mismatch
              <div className="grid grid-cols-3 gap-3">
                <div className="flex flex-col items-center gap-2 p-4 rounded-lg border-2 border-muted animate-pulse">
                  <div className="h-6 w-6 bg-muted rounded" />
                  <div className="h-4 w-12 bg-muted rounded" />
                </div>
                <div className="flex flex-col items-center gap-2 p-4 rounded-lg border-2 border-muted animate-pulse">
                  <div className="h-6 w-6 bg-muted rounded" />
                  <div className="h-4 w-12 bg-muted rounded" />
                </div>
                <div className="flex flex-col items-center gap-2 p-4 rounded-lg border-2 border-muted animate-pulse">
                  <div className="h-6 w-6 bg-muted rounded" />
                  <div className="h-4 w-12 bg-muted rounded" />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {/* Light Theme Button */}
                <button
                  onClick={() => setTheme("light")}
                  className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all hover:bg-muted/50 ${
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
                  className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all hover:bg-muted/50 ${
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
                  className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all hover:bg-muted/50 ${
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
      <div className="flex justify-end pt-4">
        <Button
          onClick={handleSaveSettings}
          disabled={saveState === "saving" || saveState === "saved" || isLoading}
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
    </div>
  );
}
