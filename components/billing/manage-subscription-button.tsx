"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function ManageSubscriptionButton() {
  const [loading, setLoading] = useState(false);

  const handleManageSubscription = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/stripe/portal", {
        method: "POST",
      });

      const data = await response.json();

      // ✅ NEW: Handle rate limit specifically
      if (response.status === 429) {
        const retryAfter = data.retryAfter || 60;
        alert(`Too many requests. Please wait ${retryAfter} seconds and try again.`);
        return;
      }

      if (!response.ok) {
        throw new Error(data.error || "Failed to open portal");
      }

      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error("No portal URL returned");
      }
    } catch (error) {
      console.error("Error opening customer portal:", error);
      alert("Failed to open subscription management. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button onClick={handleManageSubscription} disabled={loading}>
      {loading ? "Loading..." : "Manage Subscription"}
    </Button>
  );
}
