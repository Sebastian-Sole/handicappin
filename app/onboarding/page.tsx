import { redirect } from "next/navigation";
import { createServerComponentClient } from "@/utils/supabase/server";
import { PlanSelector } from "@/components/billing/plan-selector";
import { getBillingFromJWT } from "@/utils/supabase/jwt";

export default async function OnboardingPage() {
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Check if user already has access by reading JWT claims (consistent with middleware)
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Decode JWT to get custom claims (session.user.app_metadata doesn't include them)
  const billing = getBillingFromJWT(session);

  // If user has a plan in JWT, redirect to billing (they've completed onboarding)
  if (billing?.plan) {
    console.log(`✅ Onboarding: User has plan=${billing.plan} in JWT, redirecting to billing`);
    redirect("/billing");
  }

  // If JWT billing claims are missing, this is expected for new users who haven't selected a plan yet
  console.log(`🔄 Onboarding: No plan in JWT (billing=${JSON.stringify(billing)}), showing plan selection`);

  // If no access, show onboarding
  return (
    <div className="container mx-auto px-4 py-16">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Welcome to Handicappin!</h1>
          <p className="text-lg text-gray-600">
            Choose the plan that&apos;s right for you and start tracking your
            golf rounds
          </p>
        </div>

        <PlanSelector userId={user.id} mode="onboarding" />
      </div>
    </div>
  );
}
