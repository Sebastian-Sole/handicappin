"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function BillingPortalButton() {
  const [loading, setLoading] = useState(false);

  async function handlePortalAccess() {
    setLoading(true);
    try {
      const response = await fetch("/api/stripe/portal", {
        method: "POST",
      });

      const data = await response.json();

      // ✅ NEW: Handle rate limit specifically
      if (response.status === 429) {
        const retryAfter = data.retryAfter || 60;
        alert(`Too many requests. Please wait ${retryAfter} seconds and try again.`);
        setLoading(false);
        return;
      }

      if (!response.ok) {
        throw new Error(data.error || "Failed to access portal");
      }

      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error("No portal URL returned");
      }
    } catch (error) {
      console.error("Portal access error:", error);
      alert("Failed to access billing portal");
      setLoading(false);
    }
  }

  return (
    <Button onClick={handlePortalAccess} disabled={loading}>
      {loading ? "Loading..." : "Manage Subscription"}
    </Button>
  );
}
