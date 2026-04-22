"use client";

import { useState } from "react";
import { api } from "@/trpc/react";
import { FormFeedback } from "@/components/ui/form-feedback";
import {
  SaveStateButton,
  type SaveState,
} from "@/components/ui/save-state-button";
import { H3 } from "@/components/ui/typography";
import type { FeedbackState } from "@/types/feedback";

export function DataExportSection() {
  const [exportState, setExportState] = useState<SaveState>("idle");
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);

  const exportQuery = api.auth.exportUserData.useQuery(undefined, {
    enabled: false,
    refetchOnWindowFocus: false,
  });

  const handleExport = async () => {
    setExportState("saving");
    setFeedback(null);
    try {
      const result = await exportQuery.refetch();

      if (result.error || !result.data) {
        setExportState("error");
        setFeedback({
          type: "error",
          message: "Failed to export your data. Please try again.",
        });
        setTimeout(() => setExportState("idle"), 2000);
        return;
      }

      // Check if user has any data to export
      if (!result.data.hasData) {
        setExportState("idle");
        setFeedback({
          type: "info",
          message: "No data to export. Start tracking your rounds to build your golf history!",
        });
        return;
      }

      // User has data, proceed with download
      const blob = new Blob([JSON.stringify(result.data, null, 2)], {
        type: "application/json"
      });
      const url = URL.createObjectURL(blob);
      try {
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `handicappin-data-export-${new Date().toISOString().split("T")[0]}.json`;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
      } finally {
        URL.revokeObjectURL(url);
      }

      setExportState("saved");
      setFeedback(null);
      setTimeout(() => setExportState("idle"), 2000);
    } catch {
      setExportState("error");
      setFeedback({
        type: "error",
        message: "Failed to export your data. Please try again.",
      });
      setTimeout(() => setExportState("idle"), 2000);
    }
  };

  return (
    <div className="surface p-lg">
      <H3 className="text-xl font-semibold mb-sm">Export Your Data</H3>
      <p className="text-muted-foreground mb-md">
        Download a copy of all your data including your profile, rounds, and scores in JSON format.
      </p>
      {feedback && (
        <FormFeedback
          type={feedback.type}
          message={feedback.message}
          className="mb-md"
        />
      )}
      <SaveStateButton
        onClick={handleExport}
        state={exportState}
        variant="outline"
        idleLabel="Export Data"
        savingLabel="Exporting..."
        savedLabel="Downloaded!"
        errorLabel="Export Data"
        className="transition-all duration-300"
      />
    </div>
  );
}
