"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { createPortal } from "@/lib/stripe-api-client";

export function ManageSubscriptionButton() {
  const [loading, setLoading] = useState(false);

  const handleManageSubscription = async () => {
    try {
      setLoading(true);

      // ✅ NEW: Use type-safe client
      const result = await createPortal();

      if (!result.success) {
        // ✅ NEW: Type-safe error handling with retryAfter
        if (result.error.retryAfter) {
          alert(
            `Too many requests. Please wait ${result.error.retryAfter} seconds and try again.`
          );
        } else {
          throw new Error(result.error.error);
        }
        return;
      }

      // ✅ NEW: TypeScript knows result.data.url exists
      window.location.href = result.data.url;
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
