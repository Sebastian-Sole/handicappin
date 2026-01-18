"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { api } from "@/trpc/react";
import { useToast } from "@/components/ui/use-toast";

export function DataExportSection() {
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();

  const exportQuery = api.auth.exportUserData.useQuery(undefined, {
    enabled: false,
    refetchOnWindowFocus: false,
  });

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const result = await exportQuery.refetch();

      if (result.error || !result.data) {
        toast({
          title: "Export failed",
          description: "Failed to export your data. Please try again.",
          variant: "destructive",
        });
        return;
      }

      if (result.data) {
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

        toast({
          title: "Export complete",
          description: "Your data has been downloaded.",
        });
      }
    } catch (error) {
      toast({
        title: "Export failed",
        description: "Failed to export your data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="bg-card rounded-lg border p-6">
      <h3 className="text-xl font-semibold mb-2">Export Your Data</h3>
      <p className="text-muted-foreground mb-4">
        Download a copy of all your data including your profile, rounds, and scores in JSON format.
      </p>
      <Button onClick={handleExport} disabled={isExporting} variant="outline">
        {isExporting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Exporting...
          </>
        ) : (
          <>
            <Download className="mr-2 h-4 w-4" />
            Export Data
          </>
        )}
      </Button>
    </div>
  );
}
