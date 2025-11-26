"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { api } from "@/trpc/react";

export function ManageSubscriptionButton() {
  const [loading, setLoading] = useState(false);
  const createPortalMutation = api.stripe.createPortal.useMutation();

  const handleManageSubscription = async () => {
    try {
      setLoading(true);

      const result = await createPortalMutation.mutateAsync();

      window.location.href = result.url;
    } catch (error: any) {
      console.error("Error opening customer portal:", error);

      if (error?.data?.code === "TOO_MANY_REQUESTS" && error?.data?.cause?.retryAfter) {
        alert(
          `Too many requests. Please wait ${error.data.cause.retryAfter} seconds and try again.`
        );
      } else {
        alert("Failed to open subscription management. Please try again.");
      }
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
