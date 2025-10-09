import { redirect } from "next/navigation";
import { createServerComponentClient } from "@/utils/supabase/server";
import { getComprehensiveUserAccess } from "@/utils/billing/access-control";
import { getRemainingRounds } from "@/utils/billing/entitlements";
import { BillingPortalButton } from "@/components/billing/portal-button";
import { UpgradePrompt } from "@/components/billing/upgrade-prompt";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string; error?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const subscription = await getComprehensiveUserAccess(user.id);

  console.log("subscription", subscription);

  if (!subscription.hasAccess) {
    redirect("/onboarding");
  }

  const remainingRounds = await getRemainingRounds(user.id);

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">Billing & Subscription</h1>

        {params.session_id && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-6">
            ✓ Payment successful! Your subscription is now active.
          </div>
        )}

        {params.error === "subscription_issue" && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
            There&apos;s an issue with your subscription. Please update your
            payment method.
          </div>
        )}

        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h2 className="text-2xl font-semibold mb-4">Current Plan</h2>

          <div className="space-y-2">
            <p>
              <span className="font-semibold">Plan:</span>{" "}
              <span className="capitalize">{subscription.plan}</span>
              {subscription.isLifetime && " (Lifetime)"}
            </p>

            <p>
              <span className="font-semibold">Status:</span>{" "}
              <span className="capitalize">
                {subscription.hasAccess ? "active" : "inactive"}
              </span>
            </p>

            {subscription.currentPeriodEnd && (
              <p>
                <span className="font-semibold">Renews:</span>{" "}
                {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
              </p>
            )}

            {remainingRounds !== null && (
              <p>
                <span className="font-semibold">Rounds Remaining:</span>{" "}
                {remainingRounds} / 25
              </p>
            )}
          </div>

          {subscription.plan !== "free" && !subscription.isLifetime && (
            <div className="mt-6">
              <BillingPortalButton />
            </div>
          )}
        </div>

        {subscription.plan === "free" && (
          <UpgradePrompt remainingRounds={remainingRounds} />
        )}
      </div>
    </div>
  );
}
