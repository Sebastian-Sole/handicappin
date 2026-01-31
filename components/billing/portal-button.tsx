"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { api } from "@/trpc/react";
import { clientLogger } from "@/lib/client-logger";

export function BillingPortalButton() {
  const [loading, setLoading] = useState(false);
  const createPortalMutation = api.stripe.createPortal.useMutation();

  async function handlePortalAccess() {
    setLoading(true);
    try {
      const result = await createPortalMutation.mutateAsync();

      window.location.href = result.url;
    } catch (error: any) {
      clientLogger.error("Portal access error", error);

      if (error?.data?.code === "TOO_MANY_REQUESTS" && error?.data?.cause?.retryAfter) {
        alert(
          `Too many requests. Please wait ${error.data.cause.retryAfter} seconds and try again.`
        );
      } else {
        alert("Failed to access billing portal");
      }
      setLoading(false);
    }
  }

  return (
    <Button onClick={handlePortalAccess} disabled={loading}>
      {loading ? "Loading..." : "Manage Subscription"}
    </Button>
  );
}
