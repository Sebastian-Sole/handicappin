/**
 * Profile — native twin of apps/web/app/profile/[id]/page.tsx +
 * components/profile/tabbed-profile-page.tsx (Personal Information /
 * Billing / Settings). Subscription STATE is real (tRPC profile + the
 * RevenueCat-shaped billing seam); purchase/restore flows are mocked with
 * clearly-labelled dev actions (decision ledger). Plan changes, email
 * change, data export and account deletion stay on the website for now
 * (logged deferrals with visible pointers). Settings hosts Sign Out and
 * the Calculators entry point (D6).
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import type { Href } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import {
  Calculator,
  CreditCard,
  LogOut,
  Settings,
  User as UserIcon,
} from "lucide-react-native";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { z } from "zod";

import { tokens } from "@handicappin/tokens/tokens";

import { DataSettledMarker } from "@/components/data-settled";
import { Button } from "@/components/ui/button";
import { FormFeedback } from "@/components/ui/form-feedback";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { H1, H2, H3 } from "@/components/ui/typography";
import type { PaidPlan } from "@handicappin/billing-core";

import { PaywallPackages } from "@/components/billing/paywall-packages";
import { trpcMutation } from "@/lib/api/client";
import { profileQueryOptions } from "@/lib/api/procedures/auth";
import { roundCountQueryOptions } from "@/lib/api/procedures/round";
import type {
  BillingProviderId,
  PlanType,
  SubscriptionStatus,
} from "@/lib/api/schemas/profile";
import { useSession } from "@/lib/auth/session-provider";
import { PLAN_FEATURES } from "@/lib/billing/plan-content";
import {
  paywallPolicyFor,
  STRIPE_NEUTRAL_COPY,
} from "@/lib/billing/paywall-policy";
import {
  getManagementUrl,
  MOCK_RESTORE_PREFIX,
  purchasePlan,
  restorePurchases,
} from "@/lib/billing/purchase-flow";
import { useColorMode } from "@/lib/color-mode";
import { openLegalDocument, SITE_URL } from "@/lib/legal";
import { useDataSettled } from "@/lib/query/settle";
import { FREE_TIER_ROUND_LIMIT } from "@/lib/scorecard";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

const ICON_SIZE = 20; // allow-hardcoded lucide icon prop mirrors web's fixed h-5 w-5 icon box

type TabId = "personal" | "billing" | "settings";

interface FeedbackState {
  type: "success" | "error" | "info";
  message: string;
}

function formatDate(unixSeconds: number): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(unixSeconds * 1000));
}

export default function ProfileScreen() {
  const { session, initializing } = useSession();
  const params = useLocalSearchParams<{ id?: string }>();
  const insets = useSafeAreaInsets();
  const mode = useColorMode();
  const [tab, setTab] = useState<TabId>("personal");

  const routeId = typeof params.id === "string" ? params.id : null;
  const userId = session?.user.id ?? null;

  const profileQuery = useQuery({
    ...profileQueryOptions(userId ?? ""),
    enabled: userId != null,
  });
  const roundCountQuery = useQuery({
    ...roundCountQueryOptions(userId ?? ""),
    enabled: userId != null,
  });
  const settled = useDataSettled([profileQuery, roundCountQuery]);

  if (initializing) return null;
  if (!session) return <Redirect href="/login" />;
  if (routeId && userId && routeId !== userId) {
    // Web redirects to /404 for other users' profiles.
    return (
      <View className="flex-1 bg-background items-center justify-center p-lg">
        <Text className="text-body text-muted-foreground">
          This isn&apos;t your profile.
        </Text>
      </View>
    );
  }

  const profile = profileQuery.data;
  const colors = tokens.colors[mode];

  const tabs: { id: TabId; label: string; icon: typeof UserIcon }[] = [
    { id: "personal", label: "Personal", icon: UserIcon },
    { id: "billing", label: "Billing", icon: CreditCard },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  return (
    <ScrollView
      testID="profile-screen"
      className="flex-1 bg-background"
      contentContainerStyle={{
        paddingTop: insets.top + tokens.spacing.md,
        paddingHorizontal: tokens.spacing.md,
        paddingBottom: tokens.spacing["3xl"],
        gap: tokens.spacing.lg,
      }}
      keyboardShouldPersistTaps="handled"
    >
      <DataSettledMarker settled={settled} />

      <View>
        <H1 className="text-figure-xl mb-sm">Profile</H1>
        <Text className="text-lead text-muted-foreground">
          Manage your account settings
        </Text>
      </View>

      {/* Tab navigation (web's sidebar collapses to a row on phones) */}
      <View className="flex-row gap-sm">
        {tabs.map(({ id, label, icon: Icon }) => {
          const isActive = tab === id;
          return (
            <Pressable
              key={id}
              testID={`profile-tab-${id}`}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              onPress={() => setTab(id)}
              className={cn(
                "flex-1 flex-row items-center justify-center gap-sm px-md py-sm rounded-lg",
                isActive ? "bg-primary" : "bg-muted",
              )}
            >
              <Icon
                size={ICON_SIZE}
                color={
                  isActive ? colors["primary-foreground"] : colors["muted-foreground"]
                }
              />
              <Text
                className={cn(
                  "text-label-sm",
                  isActive
                    ? "text-primary-foreground"
                    : "text-muted-foreground",
                )}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {profile == null ? (
        <Text className="text-body text-muted-foreground">
          {profileQuery.isError ? "Could not load profile" : "Loading…"}
        </Text>
      ) : (
        <>
          {tab === "personal" ? (
            <PersonalTab
              profileId={profile.id}
              initialName={profile.name ?? ""}
              email={session.user.email ?? ""}
              handicapIndex={profile.handicapIndex}
            />
          ) : null}
          {tab === "billing" ? (
            <BillingTab
              plan={profile.plan_selected}
              status={profile.subscription_status}
              provider={profile.billing_provider}
              currentPeriodEnd={profile.current_period_end}
              cancelAtPeriodEnd={profile.cancel_at_period_end}
              roundCount={roundCountQuery.data ?? 0}
              userId={profile.id}
            />
          ) : null}
          {tab === "settings" ? <SettingsTab userId={profile.id} /> : null}
        </>
      )}
    </ScrollView>
  );
}

const nameSchema = z.string().min(1, "Name is required");

function PersonalTab({
  profileId,
  initialName,
  email,
  handicapIndex,
}: {
  profileId: string;
  initialName: string;
  email: string;
  handicapIndex: number;
}) {
  const [name, setName] = useState(initialName);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const queryClient = useQueryClient();

  const updateProfile = useMutation({
    mutationFn: (newName: string) =>
      trpcMutation(
        "auth.updateProfile",
        { id: profileId, name: newName },
        z.unknown(),
      ),
    onSuccess: () => {
      setFeedback({ type: "success", message: "Profile updated" });
      void queryClient.invalidateQueries({
        queryKey: ["auth.getProfileFromUserId", profileId],
      });
    },
    onError: (error) => {
      setFeedback({
        type: "error",
        message: error instanceof Error ? error.message : "Update failed",
      });
    },
  });

  const onSave = () => {
    const parsed = nameSchema.safeParse(name.trim());
    if (!parsed.success) {
      setFeedback({
        type: "error",
        message: parsed.error.issues[0]?.message ?? "Invalid name",
      });
      return;
    }
    setFeedback(null);
    updateProfile.mutate(parsed.data);
  };

  return (
    <View className="gap-lg" testID="profile-personal">
      <View className="surface p-lg rounded-lg gap-md">
        <H2 className="pb-0">Personal Information</H2>
        {feedback ? (
          <FormFeedback
            type={feedback.type}
            message={feedback.message}
            onClose={() => setFeedback(null)}
          />
        ) : null}
        <View className="gap-sm">
          <Label>Name</Label>
          <Input
            testID="profile-name"
            value={name}
            onChangeText={setName}
            autoComplete="name"
          />
        </View>
        <View className="gap-sm">
          <Label>Email</Label>
          <Input value={email} editable={false} />
          <Text className="text-meta text-muted-foreground">
            Email changes are verified by code on handicappin.com for now.
          </Text>
        </View>
        <View className="gap-sm">
          <Label>Handicap Index</Label>
          <Text className="text-figure text-primary">
            {handicapIndex.toFixed(1)}
          </Text>
        </View>
        <Button
          testID="profile-save"
          disabled={updateProfile.isPending}
          onPress={onSave}
        >
          {updateProfile.isPending ? "Saving..." : "Save Changes"}
        </Button>
      </View>
    </View>
  );
}

function BillingTab({
  plan,
  status,
  provider,
  currentPeriodEnd,
  cancelAtPeriodEnd,
  roundCount,
  userId,
}: {
  plan: PlanType | null;
  status: SubscriptionStatus | null;
  provider: BillingProviderId | null;
  currentPeriodEnd: number | null;
  cancelAtPeriodEnd: boolean;
  roundCount: number;
  userId: string;
}) {
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [changingPlan, setChangingPlan] = useState(false);
  const queryClient = useQueryClient();
  const isLifetime = plan === "lifetime";
  const remainingRounds = Math.max(0, FREE_TIER_ROUND_LIMIT - roundCount);
  const features = PLAN_FEATURES[plan ?? "free"] ?? [];

  // THE §1 policy matrix — drives every affordance below.
  const policy = paywallPolicyFor({ plan, status, provider, cancelAtPeriodEnd });
  const refreshProfile = () =>
    void queryClient.invalidateQueries({
      queryKey: ["auth.getProfileFromUserId", userId],
    });

  const onRestore = async () => {
    const result = await restorePurchases(userId);
    if (result.kind === "error") {
      setFeedback({ type: "error", message: result.message });
      return;
    }
    const list =
      result.activeEntitlements.length > 0
        ? result.activeEntitlements.join(", ")
        : "none";
    setFeedback({
      type: "info",
      message: result.mocked
        ? `${MOCK_RESTORE_PREFIX} Backend state restored — active entitlement${result.activeEntitlements.length === 1 ? "" : "s"}: ${list}.`
        : `Purchases restored — active entitlement${result.activeEntitlements.length === 1 ? "" : "s"}: ${list}.`,
    });
    if (!result.mocked) refreshProfile();
  };

  // Apple-billed plan change: the OTHER yearly tier, same subscription group.
  const planChangeTarget: PaidPlan | null =
    plan === "premium" ? "unlimited" : plan === "unlimited" ? "premium" : null;

  const onPlanChange = async (target: PaidPlan) => {
    setChangingPlan(true);
    try {
      const result = await purchasePlan(userId, target);
      if (result.kind === "mock-notice") {
        setFeedback({ type: "info", message: result.message });
      } else if (result.kind === "purchased") {
        setFeedback({
          type: "success",
          message: `Plan change complete — you're now on ${target}.`,
        });
        refreshProfile();
      } else if (result.kind === "error") {
        setFeedback({ type: "error", message: result.message });
      }
    } finally {
      setChangingPlan(false);
    }
  };

  const onAppleManage = async () => {
    const url = await getManagementUrl(userId);
    void WebBrowser.openBrowserAsync(url);
  };

  const statusLine = (() => {
    if (status === "past_due") {
      return "Payment issue — please update your payment method.";
    }
    if (currentPeriodEnd && !isLifetime) {
      return cancelAtPeriodEnd
        ? `Cancels on ${formatDate(currentPeriodEnd)}`
        : `Renews on ${formatDate(currentPeriodEnd)}`;
    }
    return null;
  })();

  return (
    <View className="gap-lg" testID="profile-billing">
      <View>
        <H2 className="mb-sm pb-0">Billing & Subscription</H2>
        <Text className="text-body text-muted-foreground">
          Manage your subscription and view plan details
        </Text>
      </View>

      {feedback ? (
        <FormFeedback
          type={feedback.type}
          message={feedback.message}
          onClose={() => setFeedback(null)}
        />
      ) : null}

      <View className="surface p-lg rounded-lg gap-md">
        <H3>Current Plan</H3>
        <View className="gap-sm">
          <Text className="text-heading-5 text-foreground capitalize">
            {plan ?? "No"} Plan
          </Text>
          {plan === "free" ? (
            <Text className="text-body text-muted-foreground">
              {remainingRounds} rounds remaining
            </Text>
          ) : null}
          {statusLine ? (
            <Text
              className={cn(
                "text-body",
                status === "past_due"
                  ? "text-destructive"
                  : "text-muted-foreground",
              )}
            >
              {statusLine}
            </Text>
          ) : null}
          {isLifetime ? (
            <Text className="text-body text-success font-medium">
              ✓ Lifetime Access
            </Text>
          ) : null}
        </View>

        <View className="gap-sm">
          {/* §1: stripe-sourced — neutral copy, deliberately NOT a link */}
          {policy.showStripeNeutralCopy ? (
            <Text
              testID="billing-stripe-neutral"
              className="text-body-sm text-muted-foreground"
            >
              {STRIPE_NEUTRAL_COPY}
            </Text>
          ) : null}

          {/* §1: apple-sourced — native plan change within the group */}
          {policy.showNativePlanChange && planChangeTarget ? (
            <Button
              testID="billing-plan-change"
              disabled={changingPlan}
              onPress={() => void onPlanChange(planChangeTarget)}
            >
              {changingPlan
                ? "Working…"
                : `Switch to ${planChangeTarget === "unlimited" ? "Unlimited" : "Premium"}`}
            </Button>
          ) : null}

          {/* §1: apple-sourced — Apple manage-subscriptions affordance */}
          {policy.showAppleManage ? (
            <Button
              testID="billing-apple-manage"
              variant="outline"
              onPress={() => void onAppleManage()}
            >
              Manage Subscription (App Store)
            </Button>
          ) : null}

          {isLifetime ? (
            <Text className="text-body-sm text-muted-foreground">
              No subscription management needed
            </Text>
          ) : null}

          {/* §1: Restore always visible */}
          <Button
            testID="billing-restore"
            variant="outline"
            onPress={() => void onRestore()}
          >
            Restore Purchases
          </Button>
        </View>
      </View>

      {/* §1: plan null/free — full paywall (purchasable) */}
      {policy.showPurchaseButtons ? (
        <PaywallPackages userId={userId} onPurchased={refreshProfile} />
      ) : null}

      <View className="surface p-lg rounded-lg gap-md">
        <H3>Plan Features</H3>
        <View className="gap-sm">
          {features.map((feature) => (
            <View key={feature.text} className="flex-row items-start gap-sm">
              <Text
                className={cn(
                  "text-body",
                  feature.included ? "text-success" : "text-destructive",
                )}
              >
                {feature.included ? "✓" : "✗"}
              </Text>
              <Text
                className={cn(
                  "text-body flex-1",
                  feature.included
                    ? "text-foreground"
                    : "text-muted-foreground",
                )}
              >
                {feature.text}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

function SettingsTab({ userId }: { userId: string }) {
  const mode = useColorMode();
  const colors = tokens.colors[mode];

  const onSignOut = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  // App Store 5.1.1(v): account deletion must be reachable in-app. Web's
  // REAL deletion flow (OTP-confirmed, cancels subscriptions, deletes auth
  // user + data) lives on the profile page's settings tab — link out to it.
  const onDeleteAccount = () => {
    void WebBrowser.openBrowserAsync(`${SITE_URL}/profile/${userId}`);
  };

  return (
    <View className="gap-lg" testID="profile-settings">
      <View>
        <H2 className="mb-sm pb-0">Settings</H2>
        <Text className="text-body text-muted-foreground">
          Account security and tools
        </Text>
      </View>

      <View className="surface p-lg rounded-lg gap-md">
        <H3>Security</H3>
        <Button
          variant="outline"
          onPress={() => router.push("/update-password")}
        >
          Change Password
        </Button>
      </View>

      <View className="surface p-lg rounded-lg gap-md">
        <H3>Tools</H3>
        <Button
          testID="settings-calculators"
          variant="outline"
          // typed-routes-forward-cast: target lands this cluster
          onPress={() => router.push("/calculators" as Href)}
        >
          <View className="flex-row items-center gap-sm">
            <Calculator size={ICON_SIZE} color={colors.foreground} />
            <Text className="text-label-sm text-foreground">
              Handicap Calculators
            </Text>
          </View>
        </Button>
        <Text className="text-meta text-muted-foreground">
          Data export is available on handicappin.com.
        </Text>
      </View>

      <View className="surface p-lg rounded-lg gap-md">
        <H3>Account</H3>
        <Text className="text-body-sm text-muted-foreground">
          Deleting your account permanently removes your profile, rounds, and
          statistics, and cancels any active subscription. Deletion is
          completed on handicappin.com (your profile page → Settings) with
          email confirmation.
        </Text>
        <Button
          testID="settings-delete-account"
          variant="outline"
          onPress={onDeleteAccount}
        >
          <Text className="text-label-sm text-destructive">Delete Account</Text>
        </Button>
      </View>

      <View className="surface p-lg rounded-lg gap-md">
        <H3>Legal</H3>
        <View className="flex-row gap-md">
          <Button
            variant="link"
            className="px-0"
            onPress={() => void openLegalDocument("terms")}
          >
            Terms of Service
          </Button>
          <Button
            variant="link"
            className="px-0"
            onPress={() => void openLegalDocument("privacy")}
          >
            Privacy Policy
          </Button>
        </View>
      </View>

      <Button
        testID="sign-out"
        variant="destructive"
        onPress={() => void onSignOut()}
      >
        <View className="flex-row items-center gap-sm">
          <LogOut size={ICON_SIZE} color={colors["destructive-foreground"]} />
          <Text className="text-label-sm text-destructive-foreground">
            Sign Out
          </Text>
        </View>
      </Button>
    </View>
  );
}
