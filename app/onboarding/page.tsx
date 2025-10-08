import { redirect } from "next/navigation";
import { createServerComponentClient } from "@/utils/supabase/server";
import { getUserSubscription } from "@/utils/billing/entitlements";
import { PlanSelector } from "@/components/billing/plan-selector";
import { PLAN_TO_PRICE_MAP } from "@/lib/stripe";

export default async function OnboardingPage() {
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Check if user already has a subscription
  const subscription = await getUserSubscription(user.id);

  if (subscription) {
    // User already has entitlement, redirect to dashboard
    redirect("/dashboard");
  }

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-center mb-4">
          Welcome to Handicappin!
        </h1>
        <p className="text-lg text-center text-gray-600 mb-12">
          Choose a plan to get started with tracking your golf handicap
        </p>

        <PlanSelector userId={user.id} priceMap={PLAN_TO_PRICE_MAP} />
      </div>
    </div>
  );
}
