"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useTheme } from "next-themes";
import { Moon, Sun, Monitor, Check } from "lucide-react";

export function SettingsTab() {
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">(
    "idle"
  );
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Notification preferences
  const [emailNotifications, setEmailNotifications] = useState(true);

  // Prevent hydration mismatch by only rendering theme buttons after mount
  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSaveSettings = async () => {
    setSaveState("saving");

    // TODO: Implement settings save logic via tRPC or API
    // For now, just simulate save
    await new Promise((resolve) => setTimeout(resolve, 800));

    setSaveState("saved");

    // Reset button state after 2 seconds
    setTimeout(() => {
      setSaveState("idle");
    }, 2000);
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
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="email-notifications">Email Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Receive important updates via email
              </p>
            </div>
            <Switch
              id="email-notifications"
              checked={emailNotifications}
              onCheckedChange={setEmailNotifications}
            />
          </div>
        </div>
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

      {/* Save Button */}
      <div className="flex justify-end pt-4">
        <Button
          onClick={handleSaveSettings}
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
    </div>
  );
}
