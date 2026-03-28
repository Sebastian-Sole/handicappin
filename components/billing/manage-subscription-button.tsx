"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { api } from "@/trpc/react";
import { clientLogger } from "@/lib/client-logger";
import { getTRPCRateLimitRetryAfter } from "@/lib/trpc-error";

export function ManageSubscriptionButton() {
  const [loading, setLoading] = useState(false);
  const createPortalMutation = api.stripe.createPortal.useMutation();

  const handleManageSubscription = async () => {
    try {
      setLoading(true);

      const result = await createPortalMutation.mutateAsync();

      window.location.href = result.url;
    } catch (error: unknown) {
      clientLogger.error("Error opening customer portal", error);

      const retryAfter = getTRPCRateLimitRetryAfter(error);
      if (retryAfter) {
        alert(
          `Too many requests. Please wait ${retryAfter} seconds and try again.`,
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
