/**
 * Onboarding — native twin of apps/web/app/onboarding/page.tsx (plan
 * selection): the FULL PAYWALL row of the §1 policy matrix (plan null →
 * purchasable). Promo slots come from the REAL stripe.getPromoSlots tRPC
 * query; paid-plan CTAs purchase through the billing seam (mock → labelled
 * dev notice; real RevenueCat SDK → App Store sheet, D-seam). Free-plan
 * selection and the EARLY100 promo claim are web server flows — they keep
 * the dev notice pointing at handicappin.com (D10). Restore is always
 * visible and the paywall carries the auto-renew disclosure + legal links
 * (App Store 3.1.2).
 */
import { useQuery } from "@tanstack/react-query";
import { Redirect } from "expo-router";
import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { PaidPlan } from "@handicappin/billing-core";
import { tokens } from "@handicappin/tokens/tokens";

import { DataSettledMarker } from "@/components/data-settled";
import { PaywallDisclosure } from "@/components/billing/paywall-disclosure";
import { PricingCard } from "@/components/billing/pricing-card";
import { Button } from "@/components/ui/button";
import { FormFeedback } from "@/components/ui/form-feedback";
import { H1 } from "@/components/ui/typography";
import { promoSlotsQueryOptions } from "@/lib/api/procedures/stripe";
import { getBillingFromJWT } from "@/lib/auth/jwt";
import { useSession } from "@/lib/auth/session-provider";
import {
  MOCK_PURCHASE_NOTICE,
  MOCK_RESTORE_PREFIX,
  purchasePlan,
  restorePurchases,
} from "@/lib/billing/purchase-flow";
import { useDataSettled } from "@/lib/query/settle";
import { PLAN_DETAILS, PLAN_FEATURES } from "@/lib/billing/plan-content";

export default function OnboardingScreen() {
  const { session, initializing } = useSession();
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const promoSlots = useQuery({
    ...promoSlotsQueryOptions(),
    enabled: session != null,
  });
  const settled = useDataSettled([promoSlots]);
  const insets = useSafeAreaInsets();

  if (initializing) return null;
  if (!session) return <Redirect href="/login" />;

  const billing = getBillingFromJWT(session);
  if (billing?.plan) {
    // Web sends plan-holders to /billing (web-only); native equivalent is home.
    return <Redirect href="/" />;
  }

  const userId = session.user.id;
  const isActiveLifetimePromo = (promoSlots.data?.remaining ?? 0) > 0;

  // Web-only server flows (free-tier selection, EARLY100 promo claim).
  const showMockNotice = () => setNotice(MOCK_PURCHASE_NOTICE);

  const onPurchase = async (plan: PaidPlan) => {
    setBusy(true);
    try {
      const result = await purchasePlan(userId, plan);
      if (result.kind === "mock-notice") {
        setNotice(result.message);
      } else if (result.kind === "purchased") {
        setNotice(
          "Purchase complete! Your plan is being activated — pull to refresh in a moment.",
        );
      } else if (result.kind === "error") {
        setNotice(result.message);
      }
    } finally {
      setBusy(false);
    }
  };

  const onRestore = async () => {
    setBusy(true);
    try {
      const result = await restorePurchases(userId);
      if (result.kind === "error") {
        setNotice(result.message);
        return;
      }
      const list =
        result.activeEntitlements.length > 0
          ? result.activeEntitlements.join(", ")
          : "none";
      setNotice(
        result.mocked
          ? `${MOCK_RESTORE_PREFIX} Backend state restored — active entitlements: ${list}.`
          : `Purchases restored — active entitlements: ${list}.`,
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView
      testID="onboarding-screen"
      className="flex-1 bg-background"
      // One style object only — combining contentContainerClassName with an
      // inline contentContainerStyle clobbers the className padding (see
      // auth-form-shell.tsx). Mirrors web PageContainer: px-md gutters.
      contentContainerStyle={{
        paddingTop: insets.top + tokens.spacing.md,
        paddingHorizontal: tokens.spacing.md,
        paddingBottom: tokens.spacing["2xl"],
        gap: tokens.spacing.lg,
      }}
    >
      <DataSettledMarker settled={settled} />
      <View className="items-center mb-2xl">
        <H1 className="mb-md text-center">Welcome to Handicappin!</H1>
        <Text className="text-lead text-muted-foreground text-center">
          Choose the plan that&apos;s right for you and start tracking your
          golf rounds
        </Text>
      </View>

      {notice ? (
        <FormFeedback
          type="info"
          message={notice}
          onClose={() => setNotice(null)}
        />
      ) : null}

      <View className="gap-lg">
        <PricingCard
          testID="plan-free"
          plan="free"
          price={PLAN_DETAILS.free.price}
          interval={PLAN_DETAILS.free.interval}
          title={PLAN_DETAILS.free.title}
          description={PLAN_DETAILS.free.description}
          features={PLAN_FEATURES["free"] ?? []}
          buttonText="Start Free"
          buttonVariant="outline"
          onButtonPress={showMockNotice}
        />
        <PricingCard
          testID="plan-premium"
          plan="premium"
          price={PLAN_DETAILS.premium.price}
          interval={PLAN_DETAILS.premium.interval}
          title={PLAN_DETAILS.premium.title}
          description={PLAN_DETAILS.premium.description}
          features={PLAN_FEATURES["premium"] ?? []}
          buttonText="Subscribe"
          costComparison={PLAN_DETAILS.premium.costComparison}
          onButtonPress={() => void onPurchase("premium")}
        />
        <PricingCard
          testID="plan-unlimited"
          plan="unlimited"
          price={PLAN_DETAILS.unlimited.price}
          interval={PLAN_DETAILS.unlimited.interval}
          title={PLAN_DETAILS.unlimited.title}
          description={PLAN_DETAILS.unlimited.description}
          features={PLAN_FEATURES["unlimited"] ?? []}
          badge={{ text: "Best Value", variant: "value" }}
          buttonText="Subscribe"
          costComparison={PLAN_DETAILS.unlimited.costComparison}
          highlighted={!isActiveLifetimePromo}
          onButtonPress={() => void onPurchase("unlimited")}
        />
        {isActiveLifetimePromo ? (
          <PricingCard
            testID="plan-lifetime"
            plan="lifetime"
            price="FREE"
            originalPrice={PLAN_DETAILS.lifetime_early_100.price}
            interval={PLAN_DETAILS.lifetime_early_100.interval}
            title={PLAN_DETAILS.lifetime_early_100.title}
            description={PLAN_DETAILS.lifetime_early_100.description}
            features={PLAN_FEATURES["lifetime"] ?? []}
            badge={{ text: "Launch Offer!", variant: "default" }}
            buttonText="Claim Free Lifetime"
            costComparison={PLAN_DETAILS.lifetime_early_100.costComparison}
            slotsRemaining={promoSlots.data?.remaining}
            highlighted
            onButtonPress={showMockNotice}
          />
        ) : (
          <PricingCard
            testID="plan-lifetime"
            plan="lifetime"
            price={PLAN_DETAILS.lifetime.price}
            interval={PLAN_DETAILS.lifetime.interval}
            title={PLAN_DETAILS.lifetime.title}
            description={PLAN_DETAILS.lifetime.description}
            features={PLAN_FEATURES["lifetime"] ?? []}
            buttonText="Buy Lifetime"
            costComparison={PLAN_DETAILS.lifetime.costComparison}
            onButtonPress={() => void onPurchase("lifetime")}
          />
        )}
      </View>

      {/* §1: Restore always visible on the paywall */}
      <Button
        testID="onboarding-restore"
        variant="outline"
        disabled={busy}
        onPress={() => void onRestore()}
      >
        Restore Purchases
      </Button>

      {/* App Store 3.1.2: auto-renew disclosure + legal links */}
      <PaywallDisclosure />
    </ScrollView>
  );
}
