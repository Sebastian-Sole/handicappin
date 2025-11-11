import { redirect } from "next/navigation";
import { createServerComponentClient } from "@/utils/supabase/server";
import { getComprehensiveUserAccess } from "@/utils/billing/access-control";
import { PlanSelector } from "@/components/billing/plan-selector";
import Link from "next/link";

export default async function UpgradePage() {
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Get current access details
  const access = await getComprehensiveUserAccess(user.id);

  // No plan selected - redirect to onboarding
  if (!access.hasAccess) {
    redirect("/onboarding");
  }

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Change Your Plan</h1>
          <p className="text-lg text-gray-600">
            Currently on: <span className="font-semibold capitalize">{access.plan}</span> Plan
          </p>
        </div>

        {/* Context-aware plan selector */}
        <PlanSelector
          userId={user.id}
          currentPlan={access.plan}
          mode="upgrade"
        />

        {/* Back to billing link */}
        <div className="text-center mt-12">
          <Link href="/billing" className="text-gray-600 hover:text-gray-800">
            ← Back to Billing
          </Link>
        </div>
      </div>
    </div>
  );
}
