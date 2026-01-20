"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2, Check } from "lucide-react";
import { api } from "@/trpc/react";
import { FormFeedback } from "@/components/ui/form-feedback";
import type { FeedbackState } from "@/types/feedback";

type ExportState = "idle" | "exporting" | "success" | "error";

export function DataExportSection() {
  const [exportState, setExportState] = useState<ExportState>("idle");
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);

  const exportQuery = api.auth.exportUserData.useQuery(undefined, {
    enabled: false,
    refetchOnWindowFocus: false,
  });

  const handleExport = async () => {
    setExportState("exporting");
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

      setExportState("success");
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
    <div className="bg-card rounded-lg border p-6">
      <h3 className="text-xl font-semibold mb-2">Export Your Data</h3>
      <p className="text-muted-foreground mb-4">
        Download a copy of all your data including your profile, rounds, and scores in JSON format.
      </p>
      {feedback && (
        <FormFeedback
          type={feedback.type}
          message={feedback.message}
          className="mb-4"
        />
      )}
      <Button
        onClick={handleExport}
        disabled={exportState === "exporting" || exportState === "success"}
        variant="outline"
        className={`transition-all duration-300 ${
          exportState === "success" ? "bg-green-600 hover:bg-green-600 text-white" : ""
        }`}
      >
        {exportState === "exporting" && (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Exporting...
          </>
        )}
        {exportState === "success" && (
          <>
            <Check className="mr-2 h-4 w-4" />
            Downloaded!
          </>
        )}
        {(exportState === "idle" || exportState === "error") && (
          <>
            <Download className="mr-2 h-4 w-4" />
            Export Data
          </>
        )}
      </Button>
    </div>
  );
}
