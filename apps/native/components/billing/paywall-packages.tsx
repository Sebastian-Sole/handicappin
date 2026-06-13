/**
 * Compact purchasable plan list — the profile billing tab's "full paywall"
 * state (§1 matrix: plan null/free → purchasable). Renders the REAL lineup
 * from the billing seam's offerings; purchases route through the seam
 * (mock → labelled dev notice, real SDK → App Store sheet).
 */
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Text, View } from "react-native";

import { appleSkuToPlan } from "@handicappin/billing-core";

import { PaywallDisclosure } from "@/components/billing/paywall-disclosure";
import { Button } from "@/components/ui/button";
import { FormFeedback } from "@/components/ui/form-feedback";
import { H3 } from "@/components/ui/typography";
import type { BillingPackage } from "@/lib/billing/types";
import { loadPackages, purchasePlan } from "@/lib/billing/purchase-flow";

export function PaywallPackages({
  userId,
  onPurchased,
}: {
  userId: string;
  /** Called after a REAL (non-mock) purchase completes. */
  onPurchased?: () => void;
}) {
  const [feedback, setFeedback] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);
  const [purchasing, setPurchasing] = useState<string | null>(null);

  const packagesQuery = useQuery({
    queryKey: ["billing", "offerings", userId],
    queryFn: () => loadPackages(userId),
  });

  const onBuy = async (pkg: BillingPackage) => {
    const plan = appleSkuToPlan(pkg.product.identifier);
    if (!plan) return;
    setPurchasing(pkg.identifier);
    try {
      const result = await purchasePlan(userId, plan);
      if (result.kind === "mock-notice") {
        setFeedback({ type: "info", message: result.message });
      } else if (result.kind === "purchased") {
        setFeedback({
          type: "success",
          message: "Purchase complete — your plan is now active.",
        });
        onPurchased?.();
      } else if (result.kind === "error") {
        setFeedback({ type: "error", message: result.message });
      }
    } finally {
      setPurchasing(null);
    }
  };

  return (
    <View className="surface p-lg rounded-lg gap-md" testID="paywall-packages">
      <H3>Upgrade Your Plan</H3>

      {feedback ? (
        <FormFeedback
          type={feedback.type}
          message={feedback.message}
          onClose={() => setFeedback(null)}
        />
      ) : null}

      {packagesQuery.isPending ? (
        <Text className="text-body text-muted-foreground">Loading plans…</Text>
      ) : null}
      {packagesQuery.isError ? (
        <Text className="text-body text-muted-foreground">
          Plans are unavailable right now.
        </Text>
      ) : null}

      {(packagesQuery.data ?? []).map((pkg) => (
        <View
          key={pkg.identifier}
          className="flex-row items-center justify-between gap-md"
        >
          <View className="flex-1">
            <Text className="text-label-sm text-foreground">
              {pkg.product.title}
            </Text>
            <Text className="text-meta text-muted-foreground">
              {pkg.product.priceString}
              {pkg.packageType === "ANNUAL" ? " · renews yearly" : ""}
              {pkg.packageType === "LIFETIME" ? " · one-time" : ""}
            </Text>
          </View>
          <Button
            testID={`paywall-buy-${pkg.identifier}`}
            size="sm"
            disabled={purchasing !== null}
            onPress={() => void onBuy(pkg)}
            // Each buy button reads "Subscribe" — give screen readers a label
            // that names the specific plan and price it purchases.
            accessibilityLabel={`Subscribe to ${pkg.product.title}, ${pkg.product.priceString}`}
          >
            {purchasing === pkg.identifier ? "…" : "Subscribe"}
          </Button>
        </View>
      ))}

      <PaywallDisclosure />
    </View>
  );
}
